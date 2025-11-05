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
    
    constructor(
        private codeAnalyzer: CodeAnalyzer,
        private learningSystem: LearningSystem,
        private context: vscode.ExtensionContext
    ) {}

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
        const documents = vscode.workspace.textDocuments;
        
        console.log(`📊 Scanne ${documents.length} offene Dokumente...`);
        
        for (const document of documents) {
            if (this.isCodeFile(document)) {
                await this.analyzeDocument(document);
            }
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
        }, 2000); // 2 Sekunden Debounce

        this.analysisQueue.set(key, timeout);
    }

    /**
     * Analysiert ein komplettes Dokument und findet undokumentierte Klassen/Funktionen
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        console.log(`🔎 Analysiere Dokument: ${document.fileName}`);
        
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
    }

    /**
     * Findet alle Klassen im Code
     */
    private findClasses(text: string, languageId: string): Array<{name: string; line: number; type: 'class'}> {
        const classes: Array<{name: string; line: number; type: 'class'}> = [];
        const lines = text.split('\n');

        let classRegex: RegExp;
        
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                classRegex = /class\s+(\w+)/;
                break;
            case 'python':
                classRegex = /class\s+(\w+)(?:\s*\(.*?\))?:/;
                break;
            case 'java':
            case 'csharp':
                classRegex = /(?:public|private|protected)?\s*class\s+(\w+)/;
                break;
            case 'go':
                classRegex = /type\s+(\w+)\s+struct/;
                break;
            default:
                classRegex = /class\s+(\w+)/;
        }

        lines.forEach((line, index) => {
            const match = line.match(classRegex);
            if (match) {
                classes.push({
                    name: match[1],
                    line: index,
                    type: 'class'
                });
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

        let functionRegexes: RegExp[];
        
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                functionRegexes = [
                    /function\s+(\w+)\s*\(/,
                    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
                    /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/,
                ];
                break;
            case 'python':
                functionRegexes = [
                    /def\s+(\w+)\s*\(/,
                ];
                break;
            case 'java':
            case 'csharp':
                functionRegexes = [
                    /(?:public|private|protected|static|async)?\s+(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*{/,
                ];
                break;
            case 'go':
                functionRegexes = [
                    /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
                ];
                break;
            default:
                functionRegexes = [
                    /function\s+(\w+)\s*\(/,
                    /def\s+(\w+)\s*\(/,
                ];
        }

        lines.forEach((line, index) => {
            for (const regex of functionRegexes) {
                const match = line.match(regex);
                if (match) {
                    functions.push({
                        name: match[1],
                        line: index,
                        type: 'function'
                    });
                    break;
                }
            }
        });

        return functions;
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
        
        await editor.edit(editBuilder => {
            const insertPos = new vscode.Position(line, 0);
            editBuilder.insert(insertPos, comment + '\n');
        });

        // Speichere für Learning System
        this.learningSystem.addTrainingExample({
            input: description,
            output: comment,
            codeContext: codeContext,
            source: 'auto-project',
            accepted: true,
            confidence: confidence,
            timestamp: Date.now()
        });

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
            
            await editor.edit(editBuilder => {
                const insertPos = new vscode.Position(line, 0);
                editBuilder.insert(insertPos, comment + '\n');
            });

            this.learningSystem.addTrainingExample({
                input: description,
                output: comment,
                codeContext: codeContext,
                source: 'auto-project',
                accepted: true,
                edited: true,
                originalSuggestion: description,
                confidence: confidence,
                timestamp: Date.now()
            });

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
        const patterns = [
            /class\s+\w+/,
            /function\s+\w+\s*\(/,
            /const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
            /def\s+\w+\s*\(/,
            /func\s+\w+\s*\(/,
            /type\s+\w+\s+struct/,
        ];
        
        return patterns.some(pattern => pattern.test(text));
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
     * Cleanup
     */
    dispose(): void {
        this.stop();
    }
}
