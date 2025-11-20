import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext } from '../analysis/codeAnalyzer';
import { LearningSystem } from '../learning/learningSystem';

/**
 * Überwacht das gesamte Projekt und dokumentiert automatisch neue Klassen und Funktionen
 */
export class ProjectMonitor {
    private fileWatcher?: vscode.FileSystemWatcher;
    private documentChangeListeners: Map<string, vscode.Disposable> = new Map();
    private analysisQueue: Map<string, NodeJS.Timeout> = new Map();
    private processedFunctions: Set<string> = new Set();
    
    // 🔒 Lock-System um mehrfache Analysen zu verhindern
    private runningAnalyses: Set<string> = new Set();
    private analysisLock: boolean = false;
    private activeNotifications: Set<string> = new Set(); // Verhindert duplicate Notifications
    
    // ✨ Erweiterte Statistiken
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
        
        // Überwache neue Dateien
        this.watchNewFiles();
        
        // Überwache Änderungen in allen offenen Dateien
        this.monitorOpenDocuments();
        
        // Analysiere alle geöffneten Dateien initial
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
        
        // File Watcher stoppen
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
        
        // Alle Document Listener stoppen
        this.documentChangeListeners.forEach(listener => listener.dispose());
        this.documentChangeListeners.clear();
        
        // Timeouts clearen
        this.analysisQueue.forEach(timeout => clearTimeout(timeout));
        this.analysisQueue.clear();
        
        vscode.window.showInformationMessage('Projekt-Überwachung deaktiviert');
    }

    /**
     * Überwacht neue Dateien im Workspace
     */
    private watchNewFiles(): void {
        // Erstelle FileSystemWatcher für Code-Dateien
        const pattern = '**/*.{ts,js,tsx,jsx,py,java,cs,go,rs,cpp,c,h}';
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Neue Datei erstellt
        this.fileWatcher.onDidCreate(async (uri) => {
            console.log(`📄 Neue Datei erkannt: ${uri.fsPath}`);
            await this.analyzeNewFile(uri);
        });

        // Datei geändert
        this.fileWatcher.onDidChange(async (uri) => {
            console.log(`📝 Datei geändert: ${uri.fsPath}`);
            // Warte kurz, dann analysiere
            this.scheduleAnalysis(uri);
        });

        this.context.subscriptions.push(this.fileWatcher);
    }

    /**
     * Überwacht alle offenen Dokumente
     */
    private monitorOpenDocuments(): void {
        // Überwache Text-Änderungen
        const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            const uri = event.document.uri.toString();
            
            // Ignoriere nicht-Code-Dateien
            if (!this.isCodeFile(event.document)) {
                return;
            }

            // Prüfe auf neue Klassen/Funktionen
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

        // Überwache neu geöffnete Dokumente
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
        // 🔒 Verhindere parallele Initial-Scans
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
                    // Kurze Pause zwischen Dokumenten um System nicht zu überlasten
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
        
        // Clear existing timeout
        const existing = this.analysisQueue.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        // Schedule new analysis
        const timeout = setTimeout(async () => {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                await this.analyzeDocument(document);
            } catch (error) {
                console.error(`Fehler bei geplanter Analyse:`, error);
            } finally {
                this.analysisQueue.delete(key);
            }
        }, 3000); // 3 Sekunden Debounce (erhöht für bessere Stabilität)

        this.analysisQueue.set(key, timeout);
    }

    /**
     * Analysiert ein komplettes Dokument und findet undokumentierte Klassen/Funktionen
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        const docKey = document.uri.toString();
        
        // 🔒 Prüfe ob bereits eine Analyse läuft für dieses Dokument
        if (this.runningAnalyses.has(docKey)) {
            console.log(`⏭️ Überspringe ${document.fileName} - Analyse läuft bereits`);
            return;
        }
        
        // 🔒 Markiere als laufend
        this.runningAnalyses.add(docKey);
        
        try {
            console.log(`🔎 Analysiere Dokument: ${document.fileName}`);
            
            // ✨ Track processed document
            this.documentsProcessed.add(document.uri.toString());
            
            const text = document.getText();
        const languageId = document.languageId;

        // Finde alle Klassen
        const classes = this.findClasses(text, languageId);
        console.log(`  📦 Gefunden: ${classes.length} Klassen`);

        // Finde alle Funktionen
        const functions = this.findFunctions(text, languageId);
        console.log(`  ⚡ Gefunden: ${functions.length} Funktionen`);

        // Analysiere und dokumentiere undokumentierte Items
        for (const item of [...classes, ...functions]) {
            const itemKey = `${document.uri.toString()}:${item.name}:${item.line}`;
            
            // Skip wenn bereits verarbeitet
            if (this.processedFunctions.has(itemKey)) {
                continue;
            }

            // Prüfe ob bereits dokumentiert
            if (this.isAlreadyDocumented(document, item.line)) {
                this.processedFunctions.add(itemKey);
                continue;
            }

            // Analysiere und dokumentiere
            await this.autoDocumentItem(document, item);
            this.processedFunctions.add(itemKey);
        }
        
        } finally {
            // 🔓 Lock freigeben
            this.runningAnalyses.delete(docKey);
        }
    }

    /**
     * Findet alle Klassen im Code - NUR echte Klassendefinitionen
     */
    private findClasses(text: string, languageId: string): Array<{name: string; line: number; type: 'class'}> {
        const classes: Array<{name: string; line: number; type: 'class'}> = [];
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Skip Kommentare
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || 
                trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) {
                return;
            }

            let match: RegExpMatchArray | null = null;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    // NUR: class ClassName { (mit optionalem export/abstract am Anfang)
                    match = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Z]\w*)\s*(?:extends\s+\w+)?\s*{/);
                    break;
                case 'python':
                    // NUR: class ClassName: oder class ClassName(...):
                    match = line.match(/^\s*class\s+([A-Z]\w*)(?:\s*\(.*?\))?\s*:/);
                    break;
                case 'java':
                case 'csharp':
                    // NUR: [modifier] class ClassName {
                    match = line.match(/^\s*(?:public|private|protected)?\s*(?:abstract|static)?\s*class\s+([A-Z]\w*)\s*(?:extends\s+\w+)?(?:implements\s+[\w,\s]+)?\s*{/);
                    break;
                case 'go':
                    // NUR: type StructName struct
                    match = line.match(/^\s*type\s+([A-Z]\w*)\s+struct\s*{/);
                    break;
            }

            if (match) {
                classes.push({
                    name: match[1],
                    line: index,
                    type: 'class'
                });
                this.totalDetections++; // ✨ Track detection
            }
        });

        return classes;
    }

    /**
     * Findet alle Funktionen im Code - NUR echte Funktionsdefinitionen
     */
    private findFunctions(text: string, languageId: string): Array<{name: string; line: number; type: 'function'}> {
        const functions: Array<{name: string; line: number; type: 'function'}> = [];
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Skip Kommentare
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || 
                trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) {
                return;
            }

            let match: RegExpMatchArray | null = null;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    // 1. function functionName() {
                    if (!match) {
                        match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([a-z_$][\w$]*)\s*\(/);
                    }
                    // 2. const/let/var functionName = function() {
                    if (!match) {
                        match = line.match(/^\s*(?:const|let|var)\s+([a-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(/);
                    }
                    // 3. const/let/var functionName = (...) =>
                    if (!match) {
                        match = line.match(/^\s*(?:const|let|var)\s+([a-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
                    }
                    // 4. async methodName() { oder methodName() { (Klassen-Methoden mit Modifier)
                    if (!match && (line.includes('async ') || line.includes('static '))) {
                        match = line.match(/^\s*(?:async|static)\s+([a-z_$][\w$]*)\s*\(/);
                    }
                    break;

                case 'python':
                    // def function_name(:
                    match = line.match(/^\s*(?:async\s+)?def\s+([a-z_][\w]*)\s*\(/);
                    break;

                case 'java':
                case 'csharp':
                    // [modifier] returnType methodName(...)
                    match = line.match(/^\s*(?:public|private|protected)\s+(?:static\s+)?(?:async\s+)?\w+\s+([a-z_$][\w$]*)\s*\(/);
                    break;

                case 'go':
                    // func functionName(...) {
                    match = line.match(/^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?([a-z_][\w]*)\s*\(/);
                    break;
            }

            if (match) {
                const functionName = match[1];
                
                // Validierung: Nur echte Funktionsnamen
                if (this.isValidFunctionName(functionName, languageId)) {
                    functions.push({
                        name: functionName,
                        line: index,
                        type: 'function'
                    });
                    this.totalDetections++; // ✨ Track detection
                }
            }
        });

        return functions;
    }

    /**
     * Validiert ob ein Name ein echter Funktionsname ist
     */
    private isValidFunctionName(name: string, languageId: string): boolean {
        // JavaScript/TypeScript Keywords ausschließen
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

        // Python Keywords
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

        // Name muss mit Buchstabe oder _ beginnen
        return /^[a-z_$][\w$]*$/i.test(name);
    }

    /**
     * Prüft ob eine Zeile bereits dokumentiert ist
     */
    private isAlreadyDocumented(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;

        // Prüfe die vorherige Zeile
        const previousLine = document.lineAt(line - 1).text.trim();
        
        // Prüfe auch 2 Zeilen davor (für mehrzeilige Kommentare)
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
        
        // 🔒 Prüfe ob bereits eine Notification für dieses Item aktiv ist
        if (this.activeNotifications.has(notificationKey)) {
            console.log(`⏭️ Überspringe Notification für ${item.name} - bereits aktiv`);
            return;
        }
        
        // Markiere als aktiv
        this.activeNotifications.add(notificationKey);
        
        try {
            // Erstelle Code-Kontext
            const codeContext = this.createCodeContext(document, item);

            // Analysiere mit CodeAnalyzer
            const analysis = await this.codeAnalyzer.analyzeCode(codeContext);

            // Prüfe Konfidenz
            const minConfidence = this.getMinConfidence();
            if (analysis.confidence < minConfidence) {
                console.log(`⚠️ Niedrige Konfidenz (${analysis.confidence}) für ${item.name}, überspringe...`);
                return;
            }

            // Zeige Notification mit Optionen
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
            // 🔓 Notification-Lock freigeben
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
     * Fügt Dokumentation ein
     */
    private async insertDocumentation(
        document: vscode.TextDocument,
        line: number,
        description: string,
        codeContext: CodeContext,
        confidence: number
    ): Promise<void> {
        const comment = this.formatComment(description, document.languageId);
        
        // Öffne das Dokument in einem Editor
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        
        // 🔒 Validiere Position (prüfe ob wir wirklich VOR der Funktion einfügen)
        const targetLine = document.lineAt(line);
        const targetText = targetLine.text.trim();
        
        // Wenn Zeile eine Funktionsdefinition ist, muss Kommentar DAVOR
        let insertLine = line;
        if (this.isFunctionOrClassStart(targetText, document.languageId)) {
            // Gut - einfügen davor
        } else {
            // Suche nach Funktionsbeginn
            for (let i = line; i < Math.min(line + 5, document.lineCount); i++) {
                const checkLine = document.lineAt(i).text.trim();
                if (this.isFunctionOrClassStart(checkLine, document.languageId)) {
                    insertLine = i;
                    break;
                }
            }
        }
        
        await editor.edit(editBuilder => {
            const insertPos = new vscode.Position(insertLine, 0);
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
        
        // ✨ Track accepted suggestion
        this.suggestionsAccepted++;

        vscode.window.showInformationMessage(
            `✅ Dokumentation für "${codeContext.functionName}" eingefügt!`
        );
    }

    /**
     * Bearbeiten und dann Dokumentation einfügen
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
            const comment = this.formatComment(edited, document.languageId);
            
            const editor = await vscode.window.showTextDocument(document, { preview: false });
            
            // 🔒 Validiere Position
            let insertLine = line;
            const targetLine = document.lineAt(line);
            const targetText = targetLine.text.trim();
            
            if (!this.isFunctionOrClassStart(targetText, document.languageId)) {
                for (let i = line; i < Math.min(line + 5, document.lineCount); i++) {
                    const checkLine = document.lineAt(i).text.trim();
                    if (this.isFunctionOrClassStart(checkLine, document.languageId)) {
                        insertLine = i;
                        break;
                    }
                }
            }
            
            await editor.edit(editBuilder => {
                const insertPos = new vscode.Position(insertLine, 0);
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
            
            // ✨ Track accepted suggestion
            this.suggestionsAccepted++;

            vscode.window.showInformationMessage(
                `✅ Bearbeitete Dokumentation für "${codeContext.functionName}" eingefügt!`
            );
        }
    }

    /**
     * Formatiert Kommentar basierend auf Sprache
     */
    private formatComment(text: string, languageId: string): string {
        const indent = ''; // Wird automatisch beim Einfügen angepasst
        
        switch (languageId) {
            case 'python':
                return `${indent}"""\n${indent}${text}\n${indent}"""`;
            
            case 'javascript':
            case 'typescript':
            case 'java':
            case 'csharp':
                // Mehrzeilige Kommentare aufteilen
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
        // Nur bei substanziellen Änderungen triggern (> 30 Zeichen)
        if (text.length < 30) {
            return false;
        }
        
        // Nur wenn komplette Zeile mit class oder function
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
            // ✨ Neue Statistiken
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
