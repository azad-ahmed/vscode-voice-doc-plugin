import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext } from '../analysis/codeAnalyzer';
import { LearningSystem } from '../learning/learningSystem';
import { CommentValidator } from './commentValidator';
import { BatchManager } from './batchManager';
import { PositionValidator } from '../intelligent-placement/positionValidator';
import { CommentPlacement } from '../intelligent-placement/claudeAnalyzer';

/**
 * 🔧 VERBESSERTER Project Monitor
 * 
 * Überwacht das gesamte Projekt und dokumentiert automatisch neue Klassen und Funktionen
 * 
 * NEUE FEATURES:
 * - Batch-Support: Verhindert mehrere Kommentare an derselben Position
 * - Position-Validierung vor dem Einfügen
 * - Intelligente Platzierung auch bei bereits vorhandenen Kommentaren
 */
export class ProjectMonitor {
    private fileWatcher?: vscode.FileSystemWatcher;
    private documentChangeListeners: Map<string, vscode.Disposable> = new Map();
    private analysisQueue: Map<string, NodeJS.Timeout> = new Map();
    private processedFunctions: Set<string> = new Set();
    
    private runningAnalyses: Set<string> = new Set();
    private analysisLock: boolean = false;
    private activeNotifications: Set<string> = new Set();
    
    // 🆕 Batch-Verwaltung für Kommentar-Einfügungen
    private currentBatchDocument?: string;
    
    private totalDetections: number = 0;
    private documentsProcessed: Set<string> = new Set();
    private suggestionsAccepted: number = 0;
    
    constructor(
        private codeAnalyzer: CodeAnalyzer,
        private learningSystem: LearningSystem,
        private context: vscode.ExtensionContext
    ) {}

    /**
     * Prüft ob Zeile eine Funktions/Klassen-Definition ist
     */
    private isFunctionOrClassStart(line: string, languageId: string): boolean {
        if (languageId === 'javascript' || languageId === 'typescript') {
            return (
                /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+/.test(line) ||
                /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/.test(line) ||
                /^\s*(?:async\s+)?\w+\s*\([^)]*\)\s*\{/.test(line) ||
                /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/.test(line)
            );
        }
        if (languageId === 'python') {
            return /^\s*(?:async\s+)?def\s+\w+\s*\(/.test(line) || /^\s*class\s+\w+/.test(line);
        }
        return false;
    }

    /**
     * Startet die Projekt-Überwachung
     */
    start(): void {
        console.log('🔍 Starte Projekt-Überwachung...');
        
        this.watchNewFiles();
        this.monitorOpenDocuments();
        this.scanAllOpenDocuments();
        
        vscode.window.showInformationMessage(
            '🔍 Projekt-Überwachung aktiviert - Neue Klassen werden automatisch dokumentiert!'
        );
    }

    /**
     * Stoppt die Projekt-Überwachung
     */
    stop(): void {
        console.log('⏹️ Stoppe Projekt-Überwachung...');
        
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
        
        this.documentChangeListeners.forEach(listener => listener.dispose());
        this.documentChangeListeners.clear();
        
        this.analysisQueue.forEach(timeout => clearTimeout(timeout));
        this.analysisQueue.clear();
        
        vscode.window.showInformationMessage('Projekt-Überwachung deaktiviert');
    }

    /**
     * Überwacht neue Dateien im Workspace
     */
    private watchNewFiles(): void {
        const pattern = '**/*.{ts,js,tsx,jsx,py,java,cs,go,rs,cpp,c,h}';
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(async (uri) => {
            console.log(`📄 Neue Datei erkannt: ${uri.fsPath}`);
            await this.analyzeNewFile(uri);
        });

        this.fileWatcher.onDidChange(async (uri) => {
            console.log(`📝 Datei geändert: ${uri.fsPath}`);
            this.scheduleAnalysis(uri);
        });

        this.context.subscriptions.push(this.fileWatcher);
    }

    /**
     * Überwacht alle offenen Dokumente
     */
    private monitorOpenDocuments(): void {
        const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            const uri = event.document.uri.toString();
            
            if (!this.isCodeFile(event.document)) {
                return;
            }

            const changes = event.contentChanges;
            for (const change of changes) {
                if (this.looksLikeNewClassOrFunction(change.text)) {
                    console.log(`🆕 Neue Klasse/Funktion erkannt in ${event.document.fileName}`);
                    this.scheduleAnalysis(event.document.uri);
                    break;
                }
            }
        });

        this.documentChangeListeners.set('textChange', changeListener);
        this.context.subscriptions.push(changeListener);

        const openListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (this.isCodeFile(document)) {
                console.log(`📖 Dokument geöffnet: ${document.fileName}`);
                this.scheduleAnalysis(document.uri);
            }
        });

        this.documentChangeListeners.set('open', openListener);
        this.context.subscriptions.push(openListener);
    }

    /**
     * Scannt alle aktuell geöffneten Dokumente
     */
    private async scanAllOpenDocuments(): Promise<void> {
        if (this.analysisLock) {
            console.log('⏭️ Initial-Scan läuft bereits, überspringe...');
            return;
        }
        
        this.analysisLock = true;
        
        try {
            const documents = vscode.workspace.textDocuments;
            
            console.log(`📊 Scanne ${documents.length} offene Dokumente...`);
            
            for (const document of documents) {
                if (this.isCodeFile(document)) {
                    await this.analyzeDocument(document);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } finally {
            this.analysisLock = false;
        }
    }

    /**
     * Analysiert eine neue Datei
     */
    private async analyzeNewFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await this.analyzeDocument(document);
        } catch (error) {
            console.error(`Fehler beim Analysieren der neuen Datei ${uri.fsPath}:`, error);
        }
    }

    /**
     * Plant eine Analyse für später (debouncing)
     */
    private scheduleAnalysis(uri: vscode.Uri): void {
        const key = uri.toString();
        
        const existing = this.analysisQueue.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const timeout = setTimeout(async () => {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                await this.analyzeDocument(document);
            } catch (error) {
                console.error(`Fehler bei geplanter Analyse:`, error);
            } finally {
                this.analysisQueue.delete(key);
            }
        }, 3000);

        this.analysisQueue.set(key, timeout);
    }

    /**
     * 🔧 VERBESSERT: Analysiert ein komplettes Dokument mit Batch-Support
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        const docKey = document.uri.toString();
        
        if (this.runningAnalyses.has(docKey)) {
            console.log(`⏭️ Überspringe ${document.fileName} - Analyse läuft bereits`);
            return;
        }
        
        this.runningAnalyses.add(docKey);
        
        // 🆕 Starte Batch für dieses Dokument
        PositionValidator.startBatch(docKey);
        this.currentBatchDocument = docKey;
        
        try {
            console.log(`🔎 Analysiere Dokument: ${document.fileName}`);
            
            this.documentsProcessed.add(document.uri.toString());
            
            const text = document.getText();
            const languageId = document.languageId;

            const classes = this.findClasses(text, languageId);
            console.log(`  📦 Gefunden: ${classes.length} Klassen`);

            const functions = this.findFunctions(text, languageId);
            console.log(`  ⚡ Gefunden: ${functions.length} Funktionen`);

            // Sammle alle undokumentierten Items
            const undocumentedItems = [];

            for (const item of [...classes, ...functions]) {
                const itemKey = `${document.uri.toString()}:${item.name}:${item.line}`;
                
                if (this.processedFunctions.has(itemKey)) {
                    continue;
                }

                if (this.isAlreadyDocumented(document, item.line)) {
                    this.processedFunctions.add(itemKey);
                    continue;
                }

                undocumentedItems.push(item);
            }

            // 🆕 Zeige Batch-Info
            if (undocumentedItems.length > 0) {
                console.log(`📝 ${undocumentedItems.length} neue undokumentierte Elemente gefunden`);
                
                // Verarbeite Items nacheinander mit Batch-Support
                for (const item of undocumentedItems) {
                    const itemKey = `${document.uri.toString()}:${item.name}:${item.line}`;
                    await this.autoDocumentItem(document, item);
                    this.processedFunctions.add(itemKey);
                }
            }
            
        } finally {
            // 🆕 Beende Batch
            // Warte kurz bevor Batch beendet wird, falls noch Einfügungen ausstehen
            await new Promise(resolve => setTimeout(resolve, 1000));
            PositionValidator.endBatch(docKey);
            this.currentBatchDocument = undefined;
            
            this.runningAnalyses.delete(docKey);
        }
    }

    /**
     * Findet alle Klassen im Code
     */
    private findClasses(text: string, languageId: string): Array<{name: string; line: number; type: 'class'}> {
        const classes: Array<{name: string; line: number; type: 'class'}> = [];
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || 
                trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) {
                return;
            }

            let match: RegExpMatchArray | null = null;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    match = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Z]\w*)\s*(?:extends\s+\w+)?\s*{/);
                    break;
                case 'python':
                    match = line.match(/^\s*class\s+([A-Z]\w*)(?:\s*\(.*?\))?\s*:/);
                    break;
                case 'java':
                case 'csharp':
                    match = line.match(/^\s*(?:public|private|protected)?\s*(?:abstract|static)?\s*class\s+([A-Z]\w*)\s*(?:extends\s+\w+)?(?:implements\s+[\w,\s]+)?\s*{/);
                    break;
                case 'go':
                    match = line.match(/^\s*type\s+([A-Z]\w*)\s+struct\s*{/);
                    break;
            }

            if (match) {
                classes.push({
                    name: match[1],
                    line: index,
                    type: 'class'
                });
                this.totalDetections++;
            }
        });

        return classes;
    }

    /**
     * Findet alle Funktionen im Code
     */
    private findFunctions(text: string, languageId: string): Array<{name: string; line: number; type: 'function'}> {
        const functions: Array<{name: string; line: number; type: 'function'}> = [];
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || 
                trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) {
                return;
            }

            let match: RegExpMatchArray | null = null;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    if (!match) {
                        match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([a-z_$][\w$]*)\s*\(/);
                    }
                    if (!match) {
                        match = line.match(/^\s*(?:const|let|var)\s+([a-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(/);
                    }
                    if (!match) {
                        match = line.match(/^\s*(?:const|let|var)\s+([a-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
                    }
                    if (!match && (line.includes('async ') || line.includes('static '))) {
                        match = line.match(/^\s*(?:async|static)\s+([a-z_$][\w$]*)\s*\(/);
                    }
                    break;

                case 'python':
                    match = line.match(/^\s*(?:async\s+)?def\s+([a-z_][\w]*)\s*\(/);
                    break;

                case 'java':
                case 'csharp':
                    match = line.match(/^\s*(?:public|private|protected)\s+(?:static\s+)?(?:async\s+)?\w+\s+([a-z_$][\w$]*)\s*\(/);
                    break;

                case 'go':
                    match = line.match(/^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?([a-z_][\w]*)\s*\(/);
                    break;
            }

            if (match) {
                const functionName = match[1];
                
                if (this.isValidFunctionName(functionName, languageId)) {
                    functions.push({
                        name: functionName,
                        line: index,
                        type: 'function'
                    });
                    this.totalDetections++;
                }
            }
        });

        return functions;
    }

    /**
     * Validiert ob ein Name ein echter Funktionsname ist
     */
    private isValidFunctionName(name: string, languageId: string): boolean {
        const jsKeywords = [
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', 'try',
            'return', 'throw', 'break', 'continue', 'typeof', 'instanceof',
            'new', 'delete', 'void', 'yield', 'await', 'import', 'export',
            'default', 'extends', 'implements', 'package', 'private', 'protected',
            'public', 'static', 'super', 'this', 'with', 'debugger', 'var',
            'let', 'const', 'class', 'enum', 'interface', 'type'
        ];

        if (languageId === 'javascript' || languageId === 'typescript') {
            if (jsKeywords.includes(name.toLowerCase())) {
                return false;
            }
        }

        const pythonKeywords = [
            'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'pass',
            'return', 'yield', 'import', 'from', 'as', 'try', 'except', 'finally',
            'with', 'class', 'def', 'lambda', 'and', 'or', 'not', 'is', 'in'
        ];

        if (languageId === 'python') {
            if (pythonKeywords.includes(name.toLowerCase())) {
                return false;
            }
        }

        return /^[a-z_$][\w$]*$/i.test(name);
    }

    /**
     * Prüft ob eine Zeile bereits dokumentiert ist
     */
    private isAlreadyDocumented(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;

        const previousLine = document.lineAt(line - 1).text.trim();
        
        let twoLinesBefore = '';
        if (line >= 2) {
            twoLinesBefore = document.lineAt(line - 2).text.trim();
        }

        const hasComment = 
            previousLine.startsWith('/*') ||
            previousLine.startsWith('//') ||
            previousLine.startsWith('*') ||
            previousLine.startsWith('#') ||
            previousLine.startsWith('"""') ||
            twoLinesBefore.startsWith('/*') ||
            twoLinesBefore.startsWith('"""');

        return hasComment;
    }

    /**
     * Dokumentiert automatisch ein Item (Klasse/Funktion)
     */
    private async autoDocumentItem(
        document: vscode.TextDocument,
        item: {name: string; line: number; type: 'class' | 'function'}
    ): Promise<void> {
        const notificationKey = `${document.uri.toString()}:${item.name}:${item.line}`;
        
        if (this.activeNotifications.has(notificationKey)) {
            console.log(`⏭️ Überspringe Notification für ${item.name} - bereits aktiv`);
            return;
        }
        
        this.activeNotifications.add(notificationKey);
        
        try {
            const codeContext = this.createCodeContext(document, item);
            const analysis = await this.codeAnalyzer.analyzeCode(codeContext);

            const minConfidence = this.getMinConfidence();
            if (analysis.confidence < minConfidence) {
                console.log(`⚠️ Niedrige Konfidenz (${analysis.confidence}) für ${item.name}, überspringe...`);
                return;
            }

            const action = await vscode.window.showInformationMessage(
                `📝 ${item.type === 'class' ? 'Klasse' : 'Funktion'} "${item.name}" dokumentieren? (${Math.round(analysis.confidence * 100)}%)`,
                { modal: false },
                'Einfügen',
                'Bearbeiten',
                'Ignorieren'
            );

            if (action === 'Einfügen') {
                await this.insertDocumentation(document, item.line, analysis.description, codeContext, analysis.confidence);
            } else if (action === 'Bearbeiten') {
                await this.editAndInsertDocumentation(document, item.line, analysis.description, codeContext, analysis.confidence);
            }

        } catch (error) {
            console.error(`Fehler beim Auto-Dokumentieren von ${item.name}:`, error);
        } finally {
            this.activeNotifications.delete(notificationKey);
        }
    }

    /**
     * Erstellt einen Code-Kontext für ein Item
     */
    private createCodeContext(
        document: vscode.TextDocument,
        item: {name: string; line: number; type: 'class' | 'function'}
    ): CodeContext {
        const startLine = Math.max(0, item.line - 2);
        const endLine = Math.min(document.lineCount - 1, item.line + 10);
        
        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const code = document.getText(range);

        return {
            code,
            line: item.line,
            functionName: item.name,
            functionType: item.type,
            languageId: document.languageId
        };
    }

    /**
     * 🔧 VERBESSERT: Fügt Dokumentation mit Position-Validierung ein
     */
    private async insertDocumentation(
        document: vscode.TextDocument,
        line: number,
        description: string,
        codeContext: CodeContext,
        confidence: number
    ): Promise<void> {
        try {
            // 🆕 Erstelle Placement-Objekt
            let placement: CommentPlacement = {
                comment: description,
                targetLine: line,
                position: 'before',
                indentation: 0,
                reasoning: 'Auto-generated documentation'
            };

            // 🆕 Validiere und korrigiere Position
            placement = PositionValidator.validateAndCorrect(document, placement, true);

            // 🆕 Markiere Position als verwendet
            PositionValidator.markPositionAsUsed(document.uri.toString(), placement.targetLine);

            // Formatiere Kommentar
            const comment = this.formatComment(description, document.languageId, placement.indentation);
            
            // Öffne das Dokument in einem Editor
            const editor = await vscode.window.showTextDocument(document, { preview: false });
            
            // Füge Kommentar ein
            await editor.edit(editBuilder => {
                const insertPos = new vscode.Position(placement.targetLine, 0);
                editBuilder.insert(insertPos, comment + '\n');
            });

            // Speichere für Learning System
            this.learningSystem.addTrainingExample({
                input: description,
                output: comment,
                codeContext: codeContext,
                source: 'auto',
                accepted: true,
                confidence: confidence,
                timestamp: Date.now()
            });
            
            this.suggestionsAccepted++;

            console.log(`✅ Dokumentation für "${codeContext.functionName}" an Zeile ${placement.targetLine} eingefügt`);

        } catch (error) {
            console.error(`Fehler beim Einfügen der Dokumentation:`, error);
            vscode.window.showErrorMessage(`Fehler beim Einfügen der Dokumentation: ${error}`);
        }
    }

    /**
     * 🔧 VERBESSERT: Bearbeiten und dann Dokumentation einfügen mit Position-Validierung
     */
    private async editAndInsertDocumentation(
        document: vscode.TextDocument,
        line: number,
        description: string,
        codeContext: CodeContext,
        confidence: number
    ): Promise<void> {
        const edited = await vscode.window.showInputBox({
            prompt: `Dokumentation für "${codeContext.functionName}" bearbeiten`,
            value: description,
            placeHolder: 'Ihre Dokumentation...'
        });

        if (edited) {
            try {
                // 🆕 Erstelle Placement-Objekt
                let placement: CommentPlacement = {
                    comment: edited,
                    targetLine: line,
                    position: 'before',
                    indentation: 0,
                    reasoning: 'User-edited documentation'
                };

                // 🆕 Validiere und korrigiere Position
                placement = PositionValidator.validateAndCorrect(document, placement, true);

                // 🆕 Markiere Position als verwendet
                PositionValidator.markPositionAsUsed(document.uri.toString(), placement.targetLine);

                // Formatiere Kommentar
                const comment = this.formatComment(edited, document.languageId, placement.indentation);
                
                const editor = await vscode.window.showTextDocument(document, { preview: false });
                
                await editor.edit(editBuilder => {
                    const insertPos = new vscode.Position(placement.targetLine, 0);
                    editBuilder.insert(insertPos, comment + '\n');
                });

                this.learningSystem.addTrainingExample({
                    input: description,
                    output: comment,
                    codeContext: codeContext,
                    source: 'auto',
                    accepted: true,
                    edited: true,
                    originalSuggestion: description,
                    confidence: confidence,
                    timestamp: Date.now()
                });
                
                this.suggestionsAccepted++;

                console.log(`✅ Bearbeitete Dokumentation für "${codeContext.functionName}" an Zeile ${placement.targetLine} eingefügt`);

            } catch (error) {
                console.error(`Fehler beim Einfügen der bearbeiteten Dokumentation:`, error);
                vscode.window.showErrorMessage(`Fehler beim Einfügen: ${error}`);
            }
        }
    }

    /**
     * 🔧 VERBESSERT: Formatiert Kommentar mit Einrückung
     */
    private formatComment(text: string, languageId: string, indentSpaces: number = 0): string {
        const indent = ' '.repeat(indentSpaces);
        
        switch (languageId) {
            case 'python':
                return `${indent}"""\n${indent}${text}\n${indent}"""`;
            
            case 'javascript':
            case 'typescript':
            case 'java':
            case 'csharp':
                const lines = text.split('\n');
                if (lines.length === 1) {
                    return `${indent}/** ${text} */`;
                } else {
                    return `${indent}/**\n${lines.map(l => `${indent} * ${l}`).join('\n')}\n${indent} */`;
                }
            
            case 'go':
            case 'rust':
                return `${indent}// ${text.replace(/\n/g, '\n' + indent + '// ')}`;
            
            default:
                return `${indent}/**\n${indent} * ${text}\n${indent} */`;
        }
    }

    /**
     * Prüft ob Text wie neue Klasse/Funktion aussieht
     */
    private looksLikeNewClassOrFunction(text: string): boolean {
        if (text.length < 30) {
            return false;
        }
        
        const hasClass = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+[A-Z]\w*\s+/m.test(text);
        const hasFunction = /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m.test(text);
        const hasDef = /^\s*(?:async\s+)?def\s+\w+\s*\(/m.test(text);
        
        return hasClass || hasFunction || hasDef;
    }

    /**
     * Prüft ob Datei eine Code-Datei ist
     */
    private isCodeFile(document: vscode.TextDocument): boolean {
        const codeLanguages = [
            'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
            'python', 'java', 'csharp', 'go', 'rust', 'cpp', 'c'
        ];
        
        return codeLanguages.includes(document.languageId);
    }

    /**
     * Holt minimale Konfidenz aus Konfiguration
     */
    private getMinConfidence(): number {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        return config.get('minConfidence', 0.7);
    }

    /**
     * Holt Statistiken über die Überwachung
     */
    getStatistics() {
        return {
            isActive: this.fileWatcher !== undefined,
            processedCount: this.processedFunctions.size,
            runningAnalyses: this.runningAnalyses.size,
            queuedAnalyses: this.analysisQueue.size,
            activeNotifications: this.activeNotifications.size,
            monitoredDocuments: this.documentChangeListeners.size,
            totalDetections: this.totalDetections,
            documentsProcessed: this.documentsProcessed.size,
            suggestionsAccepted: this.suggestionsAccepted
        };
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.stop();
        this.runningAnalyses.clear();
        this.processedFunctions.clear();
        this.activeNotifications.clear();
    }
}
