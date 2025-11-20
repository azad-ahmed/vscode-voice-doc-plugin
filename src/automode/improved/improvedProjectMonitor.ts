import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext } from '../../analysis/codeAnalyzer';
import { LearningSystem } from '../../learning/learningSystem';
import { ComplexityAnalyzer, ComplexityResult } from './complexityAnalyzer';
import { CommentQualityValidator, ValidationResult } from './qualityValidator';
import { AdaptiveDebouncer, DebounceContext } from './adaptiveDebouncer';

/**
 * 🚀 VERBESSERTER Project Monitor mit intelligenten Features
 * 
 * Neue Features:
 * ✅ Komplexitäts-Analyse
 * ✅ Qualitäts-Validierung
 * ✅ Adaptives Debouncing
 * ✅ Rate-Limiting
 * ✅ Bessere Pattern-Erkennung
 * ✅ Akzeptanz-Tracking
 */
export class ImprovedProjectMonitor {
    private fileWatcher?: vscode.FileSystemWatcher;
    private documentChangeListeners: Map<string, vscode.Disposable> = new Map();
    private processedFunctions: Set<string> = new Set();
    private debouncer: AdaptiveDebouncer;
    
    // Lock-Systeme
    private runningAnalyses: Set<string> = new Set();
    private activeNotifications: Set<string> = new Set();
    
    // Statistiken
    private stats = {
        totalDetections: 0,
        documentsProcessed: new Set<string>(),
        suggestionsShown: 0,
        suggestionsAccepted: 0,
        suggestionsRejected: 0,
        qualityIssuesFound: 0
    };
    
    constructor(
        private codeAnalyzer: CodeAnalyzer,
        private learningSystem: LearningSystem,
        private context: vscode.ExtensionContext
    ) {
        // Initialisiere Debouncer mit Config
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        this.debouncer = new AdaptiveDebouncer({
            baseDelay: config.get('autoMode.baseDelay', 5000),
            minDelay: config.get('autoMode.minDelay', 3000),
            maxDelay: config.get('autoMode.maxDelay', 15000),
            maxCallsPerHour: config.get('autoMode.maxCallsPerHour', 30)
        });
        
        console.log('✅ ImprovedProjectMonitor initialisiert mit intelligenten Features');
    }
    
    /**
     * Startet die Überwachung
     */
    start(): void {
        console.log('🔍 Starte verbesserte Projekt-Überwachung...');
        
        this.watchNewFiles();
        this.monitorOpenDocuments();
        this.scanAllOpenDocuments();
        
        vscode.window.showInformationMessage(
            '🚀 Intelligente Projekt-Überwachung aktiviert!\n' +
            '✨ Mit Komplexitäts-Analyse & Qualitätskontrolle'
        );
    }
    
    /**
     * Stoppt die Überwachung
     */
    stop(): void {
        console.log('⏹️ Stoppe Projekt-Überwachung...');
        
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
        
        this.documentChangeListeners.forEach(listener => listener.dispose());
        this.documentChangeListeners.clear();
        
        this.debouncer.cancelAll();
        
        // Zeige Abschluss-Statistik
        this.showFinalStatistics();
        
        vscode.window.showInformationMessage('Projekt-Überwachung deaktiviert');
    }
    
    /**
     * Überwacht neue Dateien
     */
    private watchNewFiles(): void {
        const pattern = '**/*.{ts,js,tsx,jsx,py,java,cs,go,rs}';
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        this.fileWatcher.onDidCreate(async (uri) => {
            console.log(`📄 Neue Datei: ${uri.fsPath}`);
            
            this.debouncer.debounce(
                `create:${uri.toString()}`,
                async () => {
                    const document = await vscode.workspace.openTextDocument(uri);
                    await this.analyzeDocument(document);
                }
            );
        });
        
        this.fileWatcher.onDidChange(async (uri) => {
            this.debouncer.debounce(
                `change:${uri.toString()}`,
                async () => {
                    const document = await vscode.workspace.openTextDocument(uri);
                    await this.analyzeDocument(document);
                }
            );
        });
        
        this.context.subscriptions.push(this.fileWatcher);
    }
    
    /**
     * Überwacht offene Dokumente
     */
    private monitorOpenDocuments(): void {
        const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (!this.isCodeFile(event.document)) {
                return;
            }
            
            const changes = event.contentChanges;
            for (const change of changes) {
                if (this.looksSignificant(change.text)) {
                    console.log(`🆕 Signifikante Änderung in ${event.document.fileName}`);
                    
                    // Berechne Kontext für Debouncer
                    const context: DebounceContext = {
                        linesChanged: change.text.split('\n').length,
                        changeType: this.detectChangeType(change.text),
                        acceptanceRate: this.getAcceptanceRate()
                    };
                    
                    this.debouncer.debounce(
                        `change:${event.document.uri.toString()}`,
                        async () => await this.analyzeDocument(event.document),
                        context
                    );
                    break;
                }
            }
        });
        
        this.documentChangeListeners.set('textChange', changeListener);
        this.context.subscriptions.push(changeListener);
    }
    
    /**
     * Scannt alle offenen Dokumente
     */
    private async scanAllOpenDocuments(): Promise<void> {
        const documents = vscode.workspace.textDocuments;
        console.log(`📊 Scanne ${documents.length} Dokumente...`);
        
        for (const document of documents) {
            if (this.isCodeFile(document)) {
                await this.analyzeDocument(document);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    
    /**
     * Analysiert ein Dokument
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        const docKey = document.uri.toString();
        
        if (this.runningAnalyses.has(docKey)) {
            console.log(`⏭️ Überspringe ${document.fileName} - läuft bereits`);
            return;
        }
        
        this.runningAnalyses.add(docKey);
        
        try {
            console.log(`🔎 Analysiere: ${document.fileName}`);
            this.stats.documentsProcessed.add(docKey);
            
            const items = this.findCodeElements(document);
            console.log(`  📦 Gefunden: ${items.length} Code-Elemente`);
            
            for (const item of items) {
                const itemKey = `${docKey}:${item.name}:${item.startLine}`;
                
                if (this.processedFunctions.has(itemKey)) {
                    continue;
                }
                
                if (this.isAlreadyDocumented(document, item.startLine)) {
                    this.processedFunctions.add(itemKey);
                    continue;
                }
                
                // ✨ NEUE: Komplexitäts-Analyse
                const complexity = ComplexityAnalyzer.analyzeComplexity(
                    document,
                    item.startLine,
                    item.name
                );
                
                // Nur dokumentieren wenn komplex genug
                if (!complexity.needsDocumentation) {
                    console.log(`  ⏭️ Überspringe "${item.name}" - zu einfach (Komplexität: ${complexity.totalComplexity})`);
                    this.processedFunctions.add(itemKey);
                    continue;
                }
                
                console.log(`  ✨ "${item.name}" braucht Dokumentation (Komplexität: ${complexity.totalComplexity})`);
                
                // Dokumentiere mit Komplexitäts-Kontext
                await this.autoDocumentItem(document, item, complexity);
                this.processedFunctions.add(itemKey);
            }
            
        } finally {
            this.runningAnalyses.delete(docKey);
        }
    }
    
    /**
     * Findet alle Code-Elemente (Klassen & Funktionen)
     */
    private findCodeElements(document: vscode.TextDocument): CodeElement[] {
        const elements: CodeElement[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        const languageId = document.languageId;
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Skip Kommentare
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') ||
                trimmed.startsWith('*') || trimmed.startsWith('#')) {
                return;
            }
            
            let match: RegExpMatchArray | null = null;
            let type: 'class' | 'function' = 'function';
            
            // Erkenne Klassen
            if (languageId === 'typescript' || languageId === 'javascript') {
                match = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)\s*(?:extends|implements|\{)/);
                if (match) {
                    type = 'class';
                }
            }
            
            // Erkenne Funktionen (nur wenn keine Klasse)
            if (!match) {
                // Standard Funktionen
                match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([a-z_$][A-Za-z0-9_$]*)\s*\(/);
                
                // Arrow Functions
                if (!match) {
                    match = line.match(/^\s*(?:const|let|var)\s+([a-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
                }
                
                // Methoden
                if (!match && (line.includes('async ') || line.includes('static ') || line.includes('private ') || line.includes('public '))) {
                    match = line.match(/^\s*(?:async|static|private|public|protected)\s+([a-z_$][A-Za-z0-9_$]*)\s*\(/);
                }
            }
            
            if (match && this.isValidName(match[1], languageId)) {
                elements.push({
                    name: match[1],
                    startLine: index,
                    type: type
                });
                this.stats.totalDetections++;
            }
        });
        
        return elements;
    }
    
    /**
     * Validiert Namen
     */
    private isValidName(name: string, languageId: string): boolean {
        const keywords = [
            'if', 'else', 'for', 'while', 'switch', 'case', 'break',
            'continue', 'return', 'throw', 'try', 'catch', 'finally',
            'function', 'class', 'const', 'let', 'var', 'import', 'export'
        ];
        
        return !keywords.includes(name.toLowerCase()) && /^[a-z_$][A-Za-z0-9_$]*$/i.test(name);
    }
    
    /**
     * Auto-dokumentiert ein Code-Element
     */
    private async autoDocumentItem(
        document: vscode.TextDocument,
        item: CodeElement,
        complexity: ComplexityResult
    ): Promise<void> {
        const notificationKey = `${document.uri.toString()}:${item.name}:${item.startLine}`;
        
        if (this.activeNotifications.has(notificationKey)) {
            return;
        }
        
        this.activeNotifications.add(notificationKey);
        
        try {
            // Erstelle Code-Kontext
            const codeContext = this.createCodeContext(document, item, complexity);
            
            // Analysiere mit CodeAnalyzer
            const analysis = await this.codeAnalyzer.analyzeCode(codeContext);
            
            // ✨ NEUE: Qualitäts-Validierung
            const validation = CommentQualityValidator.validate(
                analysis.description,
                codeContext.code,
                item.name,
                document.languageId
            );
            
            if (!validation.isValid) {
                console.log(`⚠️ Qualitätsprobleme bei "${item.name}":`, validation.issues);
                this.stats.qualityIssuesFound++;
                
                // Versuche Verbesserung
                const improved = CommentQualityValidator.improve(
                    analysis.description,
                    validation.issues
                );
                
                // Re-validiere
                const revalidation = CommentQualityValidator.validate(
                    improved,
                    codeContext.code,
                    item.name,
                    document.languageId
                );
                
                if (!revalidation.isValid) {
                    console.log(`❌ Konnte Qualität nicht verbessern für "${item.name}", überspringe`);
                    return;
                }
                
                analysis.description = improved;
            }
            
            // Zeige Notification mit Komplexitäts-Info
            this.stats.suggestionsShown++;
            
            const complexityIcon = this.getComplexityIcon(complexity.complexityLevel);
            const qualityIcon = validation.score >= 80 ? '🟢' : validation.score >= 60 ? '🟡' : '🔴';
            
            const action = await vscode.window.showInformationMessage(
                `📝 ${item.type === 'class' ? 'Klasse' : 'Funktion'} "${item.name}"\n` +
                `${complexityIcon} Komplexität: ${complexity.totalComplexity}\n` +
                `${qualityIcon} Qualität: ${validation.score}%`,
                { modal: false },
                'Einfügen',
                'Bearbeiten',
                'Preview',
                'Ignorieren'
            );
            
            if (action === 'Preview') {
                await this.showPreview(analysis.description, validation, complexity, action);
            } else if (action === 'Einfügen') {
                await this.insertDocumentation(document, item.startLine, analysis.description, codeContext, analysis.confidence);
                this.stats.suggestionsAccepted++;
            } else if (action === 'Bearbeiten') {
                await this.editAndInsertDocumentation(document, item.startLine, analysis.description, codeContext, analysis.confidence);
                this.stats.suggestionsAccepted++;
            } else {
                this.stats.suggestionsRejected++;
            }
            
        } catch (error) {
            console.error(`Fehler beim Auto-Dokumentieren von ${item.name}:`, error);
        } finally {
            this.activeNotifications.delete(notificationKey);
        }
    }
    
    /**
     * Zeigt Preview
     */
    private async showPreview(
        comment: string,
        validation: ValidationResult,
        complexity: ComplexityResult,
        followUpAction: string | undefined
    ): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'commentPreview',
            '📖 Kommentar Preview',
            vscode.ViewColumn.Beside,
            {}
        );
        
        panel.webview.html = this.generatePreviewHTML(comment, validation, complexity);
    }
    
    /**
     * Generiert Preview HTML
     */
    private generatePreviewHTML(
        comment: string,
        validation: ValidationResult,
        complexity: ComplexityResult
    ): string {
        const issuesHTML = validation.issues.length > 0
            ? validation.issues.map(issue => `
                <li class="issue issue-${issue.severity}">
                    <strong>${issue.message}</strong><br/>
                    <em>${issue.suggestion}</em>
                </li>
            `).join('')
            : '<li class="no-issues">✅ Keine Probleme gefunden</li>';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        padding: 20px;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .comment-box {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-left: 4px solid var(--vscode-activityBar-activeBorder);
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                        font-family: 'Courier New', monospace;
                    }
                    .metrics {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px;
                        margin: 20px 0;
                    }
                    .metric {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 10px;
                        border-radius: 4px;
                    }
                    .metric-value {
                        font-size: 24px;
                        font-weight: bold;
                        color: var(--vscode-activityBar-activeBorder);
                    }
                    .issues { list-style: none; padding: 0; }
                    .issue {
                        margin: 10px 0;
                        padding: 10px;
                        border-radius: 4px;
                    }
                    .issue-high { background: rgba(255, 0, 0, 0.1); }
                    .issue-medium { background: rgba(255, 165, 0, 0.1); }
                    .issue-low { background: rgba(255, 255, 0, 0.1); }
                    .no-issues { color: var(--vscode-testing-iconPassed); }
                </style>
            </head>
            <body>
                <h1>📖 Kommentar Preview</h1>
                
                <div class="comment-box">
                    <pre>${comment}</pre>
                </div>
                
                <h2>📊 Metriken</h2>
                <div class="metrics">
                    <div class="metric">
                        <div>Qualität</div>
                        <div class="metric-value">${validation.score}%</div>
                    </div>
                    <div class="metric">
                        <div>Komplexität</div>
                        <div class="metric-value">${complexity.totalComplexity}</div>
                    </div>
                    <div class="metric">
                        <div>Codezeilen</div>
                        <div class="metric-value">${complexity.metrics.linesOfCode}</div>
                    </div>
                    <div class="metric">
                        <div>Parameter</div>
                        <div class="metric-value">${complexity.metrics.parameterCount}</div>
                    </div>
                </div>
                
                <h2>🔍 Qualitäts-Analyse</h2>
                <p>${validation.recommendation}</p>
                <ul class="issues">
                    ${issuesHTML}
                </ul>
            </body>
            </html>
        `;
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
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(line, 0), comment + '\n');
        });
        
        this.learningSystem.addTrainingExample({
            input: description,
            output: comment,
            codeContext: codeContext,
            source: 'auto',
            accepted: true,
            confidence: confidence,
            timestamp: Date.now()
        });
        
        vscode.window.showInformationMessage(
            `✅ Dokumentation für "${codeContext.functionName}" eingefügt!`
        );
    }
    
    /**
     * Bearbeiten und einfügen
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
                editBuilder.insert(new vscode.Position(line, 0), comment + '\n');
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
            
            vscode.window.showInformationMessage(
                `✅ Bearbeitete Dokumentation eingefügt!`
            );
        }
    }
    
    /**
     * Erstellt Code-Kontext
     */
    private createCodeContext(
        document: vscode.TextDocument,
        item: CodeElement,
        complexity: ComplexityResult
    ): CodeContext {
        const range = new vscode.Range(
            new vscode.Position(complexity.startLine, 0),
            new vscode.Position(complexity.endLine, document.lineAt(complexity.endLine).text.length)
        );
        const code = document.getText(range);
        
        return {
            code,
            line: item.startLine,
            functionName: item.name,
            functionType: item.type,
            languageId: document.languageId
        };
    }
    
    /**
     * Formatiert Kommentar
     */
    private formatComment(text: string, languageId: string): string {
        switch (languageId) {
            case 'python':
                return `"""\n${text}\n"""`;
            case 'javascript':
            case 'typescript':
                return `/**\n * ${text.replace(/\n/g, '\n * ')}\n */`;
            default:
                return `/** ${text} */`;
        }
    }
    
    /**
     * Prüft ob bereits dokumentiert
     */
    private isAlreadyDocumented(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;
        
        const previousLine = document.lineAt(line - 1).text.trim();
        const twoLinesBefore = line >= 2 ? document.lineAt(line - 2).text.trim() : '';
        
        return (
            previousLine.startsWith('/*') ||
            previousLine.startsWith('//') ||
            previousLine.startsWith('*') ||
            previousLine.startsWith('#') ||
            previousLine.startsWith('"""') ||
            twoLinesBefore.startsWith('/*') ||
            twoLinesBefore.startsWith('"""')
        );
    }
    
    /**
     * Prüft ob Änderung signifikant ist
     */
    private looksSignificant(text: string): boolean {
        if (text.length < 30) return false;
        
        const hasClass = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+[A-Z]/m.test(text);
        const hasFunction = /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m.test(text);
        const hasMethod = /^\s*(?:async|static|private|public)\s+\w+\s*\(/m.test(text);
        
        return hasClass || hasFunction || hasMethod;
    }
    
    /**
     * Erkennt Änderungs-Typ
     */
    private detectChangeType(text: string): 'class' | 'function' | 'method' | 'minor' {
        if (/class\s+\w+/.test(text)) return 'class';
        if (/function\s+\w+/.test(text)) return 'function';
        if (/(async|static|private|public)\s+\w+\s*\(/.test(text)) return 'method';
        return 'minor';
    }
    
    /**
     * Holt Akzeptanz-Rate
     */
    private getAcceptanceRate(): number {
        const total = this.stats.suggestionsShown;
        if (total === 0) return 0.5; // Default
        return this.stats.suggestionsAccepted / total;
    }
    
    /**
     * Prüft ob Code-Datei
     */
    private isCodeFile(document: vscode.TextDocument): boolean {
        const codeLanguages = [
            'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
            'python', 'java', 'csharp', 'go', 'rust'
        ];
        return codeLanguages.includes(document.languageId);
    }
    
    /**
     * Holt Komplexitäts-Icon
     */
    private getComplexityIcon(level: string): string {
        const icons = {
            'trivial': '🟢',
            'low': '🟢',
            'medium': '🟡',
            'high': '🟠',
            'very-high': '🔴'
        };
        return icons[level as keyof typeof icons] || '⚪';
    }
    
    /**
     * Zeigt finale Statistiken
     */
    private showFinalStatistics(): void {
        const acceptanceRate = this.stats.suggestionsShown > 0
            ? Math.round((this.stats.suggestionsAccepted / this.stats.suggestionsShown) * 100)
            : 0;
        
        vscode.window.showInformationMessage(
            `📊 Auto-Modus Statistik:\n\n` +
            `• ${this.stats.totalDetections} Elemente erkannt\n` +
            `• ${this.stats.documentsProcessed.size} Dateien analysiert\n` +
            `• ${this.stats.suggestionsAccepted}/${this.stats.suggestionsShown} Vorschläge akzeptiert (${acceptanceRate}%)\n` +
            `• ${this.stats.qualityIssuesFound} Qualitätsprobleme verhindert`
        );
    }
    
    /**
     * Holt Statistiken
     */
    getStatistics() {
        return {
            isActive: this.fileWatcher !== undefined,
            ...this.stats,
            documentsProcessed: this.stats.documentsProcessed.size,
            processedCount: this.processedFunctions.size,
            runningAnalyses: this.runningAnalyses.size,
            activeNotifications: this.activeNotifications.size,
            debouncerStats: this.debouncer.getStatistics()
        };
    }
    
    /**
     * Cleanup
     */
    dispose(): void {
        this.stop();
        this.debouncer.dispose();
        this.runningAnalyses.clear();
        this.processedFunctions.clear();
        this.activeNotifications.clear();
    }
}

/**
 * Code-Element
 */
interface CodeElement {
    name: string;
    startLine: number;
    type: 'class' | 'function';
}
