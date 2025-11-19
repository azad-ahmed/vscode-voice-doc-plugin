import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext, AnalysisResult } from '../analysis/codeAnalyzer';
import { LearningSystem } from '../learning/learningSystem';
import { ProjectMonitor } from './projectMonitor';

/**
 * ✨ OPTIMIERT: Auto-Mode Controller mit AKTIVIERTEM ProjectMonitor
 * 
 * Features:
 * - ✅ ProjectMonitor ist wieder aktiviert
 * - ✅ Intelligente Projekt-Überwachung
 * - ✅ Automatische Erkennung neuer Klassen/Funktionen
 * - ✅ Manuelle Analyse weiterhin möglich
 */
export class AutoModeController {
    private isEnabled: boolean = false;
    private statusBarItem: vscode.StatusBarItem;
    
    // ✨ NEU: ProjectMonitor wieder aktiviert!
    private projectMonitor: ProjectMonitor;

    constructor(
        private codeAnalyzer: CodeAnalyzer,
        private learningSystem: LearningSystem,
        private context: vscode.ExtensionContext
    ) {
        // ✨ Initialisiere ProjectMonitor
        this.projectMonitor = new ProjectMonitor(
            codeAnalyzer,
            learningSystem,
            context
        );
        
        // Status Bar Setup
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            99
        );
        this.statusBarItem.command = 'voiceDocPlugin.toggleAutoMode';
        this.updateStatusBar();
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);

        console.log('✅ AutoModeController mit ProjectMonitor initialisiert');
    }

    /**
     * ✨ VERBESSERT: Aktiviert Auto-Mode mit ProjectMonitor
     */
    async enable(): Promise<void> {
        if (this.isEnabled) {
            vscode.window.showInformationMessage('🤖 Auto-Modus ist bereits aktiviert');
            return;
        }

        this.isEnabled = true;
        
        // ✨ Starte ProjectMonitor
        this.projectMonitor.start();
        
        this.updateStatusBar();
        
        vscode.window.showInformationMessage(
            '✅ Auto-Modus aktiviert!\n\n' +
            '👁️ Überwacht GESAMTES Projekt\n' +
            '🆕 Erkennt neue Klassen/Funktionen automatisch\n' +
            '📝 Schlägt intelligente Dokumentation vor\n' +
            '🧠 Lernt aus deinem Feedback\n\n' +
            '💡 Intelligente Überwachung läuft im Hintergrund!',
            'Details'
        ).then(action => {
            if (action === 'Details') {
                this.showAutoModeInfo();
            }
        });
        
        console.log('✅ Auto-Modus aktiviert - ProjectMonitor gestartet');
    }

    /**
     * ✨ VERBESSERT: Deaktiviert Auto-Mode
     */
    disable(): void {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        
        // ✨ Stoppe ProjectMonitor
        this.projectMonitor.stop();
        
        this.updateStatusBar();
        
        const stats = this.projectMonitor.getStatistics();
        vscode.window.showInformationMessage(
            `Auto-Modus deaktiviert\n\n` +
            `📊 Statistik:\n` +
            `- ${stats.totalDetections} Elemente erkannt\n` +
            `- ${stats.documentsProcessed} Dateien analysiert\n` +
            `- ${stats.suggestionsAccepted} Vorschläge akzeptiert`
        );
        
        console.log('⏹️ Auto-Modus deaktiviert - ProjectMonitor gestoppt');
    }

    /**
     * Wechselt Auto-Mode an/aus
     */
    async toggle(): Promise<void> {
        if (this.isEnabled) {
            this.disable();
        } else {
            await this.enable();
        }
    }

    /**
     * Aktiviert Auto-Mode direkt (ohne Bestätigung) - für Startup
     */
    enableDirect(): void {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.projectMonitor.start();
        this.updateStatusBar();
        
        console.log('✅ Auto-Modus direkt aktiviert');
    }

    /**
     * Gibt zurück ob Auto-Mode aktiviert ist
     */
    isActive(): boolean {
        return this.isEnabled;
    }

    /**
     * ✨ VERBESSERT: Analysiert die aktuelle Funktion manuell
     */
    async analyzeCurrentFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('❌ Kein aktiver Editor');
            return;
        }

        const position = editor.selection.active;
        const codeContext = this.getCodeContext(editor, position);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `🔍 Analysiere "${codeContext.functionName}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 30, message: 'Code-Analyse...' });
                
                const analysis = await this.codeAnalyzer.analyzeCode(codeContext);
                
                progress.report({ increment: 40, message: 'Vorschlag erstellen...' });
                
                await this.suggestDocumentation(analysis, position, codeContext, editor);
                
                progress.report({ increment: 30, message: 'Fertig!' });
                
            } catch (error) {
                vscode.window.showErrorMessage(
                    `❌ Analyse fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
                );
                console.error('Analyse Error:', error);
            }
        });
    }

    /**
     * ✨ NEU: Zeigt detaillierte Auto-Mode Informationen
     */
    private async showAutoModeInfo(): Promise<void> {
        const stats = this.projectMonitor.getStatistics();
        
        const panel = vscode.window.createWebviewPanel(
            'autoModeInfo',
            '👁️ Auto-Modus Information',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateInfoHTML(stats);
    }

    /**
     * ✨ NEU: Generiert Info-HTML
     */
    private generateInfoHTML(stats: any): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        padding: 20px;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .info-card {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-left: 4px solid var(--vscode-activityBar-activeBorder);
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 4px;
                    }
                    .stat {
                        font-size: 24px;
                        font-weight: bold;
                        color: var(--vscode-activityBar-activeBorder);
                    }
                    h1 { color: var(--vscode-activityBar-activeBorder); }
                    h3 { margin-top: 20px; }
                </style>
            </head>
            <body>
                <h1>👁️ Auto-Modus - Projekt-Überwachung</h1>
                
                <div class="info-card">
                    <h3>Was macht der Auto-Modus?</h3>
                    <ul>
                        <li>✅ Überwacht ALLE Dateien im Projekt automatisch</li>
                        <li>✅ Erkennt neue Klassen und Funktionen sofort</li>
                        <li>✅ Analysiert Code mit KI (GPT-4)</li>
                        <li>✅ Schlägt intelligente Dokumentation vor</li>
                        <li>✅ Lernt aus deinem Feedback</li>
                    </ul>
                </div>

                <div class="info-card">
                    <h3>📊 Aktuelle Statistik</h3>
                    <p>Elemente erkannt: <span class="stat">${stats.totalDetections}</span></p>
                    <p>Dateien verarbeitet: <span class="stat">${stats.documentsProcessed}</span></p>
                    <p>Vorschläge akzeptiert: <span class="stat">${stats.suggestionsAccepted}</span></p>
                    <p>Aktive Überwachung: <span class="stat">${stats.isMonitoring ? '✅ JA' : '❌ NEIN'}</span></p>
                </div>

                <div class="info-card">
                    <h3>🎯 Wie verwenden?</h3>
                    <ol>
                        <li>Auto-Modus aktivieren: <code>Ctrl+Shift+A</code></li>
                        <li>Code schreiben wie gewohnt</li>
                        <li>Bei neuer Klasse/Funktion → Benachrichtigung erscheint</li>
                        <li>Wähle: "Einfügen", "Bearbeiten" oder "Ignorieren"</li>
                        <li>Fertig! 🎉</li>
                    </ol>
                </div>

                <div class="info-card">
                    <h3>⚙️ Einstellungen</h3>
                    <p>Minimale Konfidenz: <code>voiceDocPlugin.minConfidence</code> (Standard: 70%)</p>
                    <p>Learning aktiviert: <code>voiceDocPlugin.learningEnabled</code></p>
                    <p>Auto-Modus: <code>voiceDocPlugin.autoMode</code></p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * ✨ VERBESSERT: Aktualisiert die Status-Leiste mit mehr Info
     */
    private updateStatusBar(): void {
        if (this.isEnabled) {
            const stats = this.projectMonitor.getStatistics();
            
            this.statusBarItem.text = `$(eye) Auto [${stats.totalDetections}]`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.prominentBackground'
            );
            this.statusBarItem.tooltip = 
                "👁️ Auto-Modus AKTIV\n\n" +
                `📊 ${stats.totalDetections} Elemente erkannt\n` +
                `📁 ${stats.documentsProcessed} Dateien analysiert\n` +
                `✅ ${stats.suggestionsAccepted} Vorschläge akzeptiert\n\n` +
                "💡 Überwacht automatisch neue Klassen/Funktionen\n" +
                "🖱️ Rechtsklick → Voice Doc → Analysieren\n\n" +
                "Klicken zum Deaktivieren (oder Ctrl+Shift+A)";
        } else {
            this.statusBarItem.text = "$(circle-slash) Auto";
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = 
                "❌ Auto-Modus deaktiviert\n\n" +
                "Klicken zum Aktivieren (oder Ctrl+Shift+A)";
        }
    }

    /**
     * Erstellt Code-Kontext für Analyse
     */
    private getCodeContext(editor: vscode.TextEditor, position: vscode.Position): CodeContext {
        const document = editor.document;
        const lineCount = document.lineCount;
        
        // Erweitere Kontext-Fenster für bessere Analyse
        const contextLines = 10; // War 5, jetzt 10 für mehr Kontext
        const startLine = Math.max(0, position.line - contextLines);
        const endLine = Math.min(lineCount - 1, position.line + contextLines);
        
        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const contextCode = document.getText(range);
        
        const functionInfo = this.detectFunctionOrClass(document, position);
        
        return {
            code: contextCode,
            line: position.line,
            functionName: functionInfo.name,
            functionType: functionInfo.type,
            languageId: document.languageId
        };
    }

    /**
     * Erkennt Funktion oder Klasse an Position
     */
    private detectFunctionOrClass(document: vscode.TextDocument, position: vscode.Position): { name: string; type: any } {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        // Regex für verschiedene Funktions-Typen
        const functionRegex = /(?:function|const|let|var|async|def)\s+(\w+)\s*[=\(]/g;
        const classRegex = /class\s+(\w+)/g;
        const methodRegex = /(\w+)\s*\([^)]*\)\s*[:{]/g; // Für Methoden
        
        let match;
        let closestFunction: any = { name: 'unknown', type: 'code', distance: Infinity };
        
        // Suche Funktionen
        while ((match = functionRegex.exec(text)) !== null) {
            const distance = Math.abs(match.index - offset);
            if (distance < closestFunction.distance && match.index < offset) {
                closestFunction = {
                    name: match[1],
                    type: 'function',
                    distance: distance
                };
            }
        }
        
        // Suche Klassen
        while ((match = classRegex.exec(text)) !== null) {
            const distance = Math.abs(match.index - offset);
            if (distance < closestFunction.distance && match.index < offset) {
                closestFunction = {
                    name: match[1],
                    type: 'class',
                    distance: distance
                };
            }
        }
        
        // Suche Methoden
        while ((match = methodRegex.exec(text)) !== null) {
            const distance = Math.abs(match.index - offset);
            if (distance < closestFunction.distance && match.index < offset) {
                closestFunction = {
                    name: match[1],
                    type: 'method',
                    distance: distance
                };
            }
        }
        
        return closestFunction;
    }

    /**
     * ✨ VERBESSERT: Schlägt Dokumentation vor mit mehr Optionen
     */
    private async suggestDocumentation(
        analysis: AnalysisResult,
        position: vscode.Position,
        codeContext: CodeContext,
        editor: vscode.TextEditor
    ): Promise<void> {
        const confidencePercent = Math.round(analysis.confidence * 100);
        const confidenceEmoji = confidencePercent >= 80 ? '🟢' : confidencePercent >= 60 ? '🟡' : '🔴';
        
        const action = await vscode.window.showInformationMessage(
            `📝 Dokumentation für "${codeContext.functionName}"\n` +
            `${confidenceEmoji} Konfidenz: ${confidencePercent}%`,
            { modal: false },
            'Einfügen',
            'Bearbeiten',
            'Preview',
            'Ignorieren'
        );

        if (action === 'Preview') {
            // Zeige Preview
            await vscode.window.showInformationMessage(
                `📖 Preview:\n\n${analysis.description}`,
                'Einfügen',
                'Bearbeiten',
                'Abbrechen'
            ).then(async (previewAction) => {
                if (previewAction === 'Einfügen') {
                    await this.insertDocumentation(analysis, position, codeContext, editor);
                } else if (previewAction === 'Bearbeiten') {
                    await this.editAndInsertDocumentation(analysis, position, codeContext, editor);
                }
            });
            
        } else if (action === 'Einfügen') {
            await this.insertDocumentation(analysis, position, codeContext, editor);

        } else if (action === 'Bearbeiten') {
            await this.editAndInsertDocumentation(analysis, position, codeContext, editor);
            
        } else {
            // Ignoriert - negatives Feedback
            this.learningSystem.addTrainingExample({
                input: analysis.description,
                output: '',
                codeContext: codeContext,
                source: 'auto',
                accepted: false,
                confidence: analysis.confidence,
                timestamp: Date.now()
            });
        }
    }

    /**
     * ✨ NEU: Fügt Dokumentation ein
     */
    private async insertDocumentation(
        analysis: AnalysisResult,
        position: vscode.Position,
        codeContext: CodeContext,
        editor: vscode.TextEditor
    ): Promise<void> {
        const comment = this.formatComment(analysis.description, codeContext.languageId);
        
        await editor.edit(editBuilder => {
            const insertPos = new vscode.Position(position.line, 0);
            editBuilder.insert(insertPos, comment + '\n');
        });

        // Learning System Feedback
        this.learningSystem.addTrainingExample({
            input: analysis.description,
            output: comment,
            codeContext: codeContext,
            source: 'auto',
            accepted: true,
            confidence: analysis.confidence,
            timestamp: Date.now()
        });

        vscode.window.showInformationMessage(
            `✅ Dokumentation für "${codeContext.functionName}" eingefügt!`
        );
    }

    /**
     * ✨ NEU: Bearbeiten und dann einfügen
     */
    private async editAndInsertDocumentation(
        analysis: AnalysisResult,
        position: vscode.Position,
        codeContext: CodeContext,
        editor: vscode.TextEditor
    ): Promise<void> {
        const edited = await vscode.window.showInputBox({
            prompt: 'Dokumentation bearbeiten',
            value: analysis.description,
            placeHolder: 'Ihre Dokumentation...',
            ignoreFocusOut: true
        });

        if (edited) {
            const comment = this.formatComment(edited, codeContext.languageId);
            
            await editor.edit(editBuilder => {
                const insertPos = new vscode.Position(position.line, 0);
                editBuilder.insert(insertPos, comment + '\n');
            });

            // Learning System mit Edit-Info
            this.learningSystem.addTrainingExample({
                input: analysis.description,
                output: comment,
                codeContext: codeContext,
                source: 'auto',
                accepted: true,
                edited: true,
                originalSuggestion: analysis.description,
                confidence: analysis.confidence,
                timestamp: Date.now()
            });

            vscode.window.showInformationMessage(
                `✅ Bearbeitete Dokumentation für "${codeContext.functionName}" eingefügt!`
            );
        }
    }

    /**
     * Formatiert Kommentar nach Sprache
     */
    private formatComment(text: string, languageId: string): string {
        switch (languageId) {
            case 'python':
                return `"""\n${text}\n"""`;
            case 'javascript':
            case 'typescript':
            case 'java':
            case 'csharp':
                return `/**\n * ${text}\n */`;
            case 'go':
            case 'rust':
                return `// ${text}`;
            default:
                return `/**\n * ${text}\n */`;
        }
    }

    /**
     * Holt minimale Konfidenz aus Einstellungen
     */
    private getMinConfidence(): number {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        return config.get('minConfidence', 0.7);
    }

    /**
     * ✨ VERBESSERT: Cleanup mit Statistik-Report
     */
    dispose(): void {
        if (this.isEnabled) {
            const stats = this.projectMonitor.getStatistics();
            console.log('📊 Auto-Modus Statistik bei Cleanup:', stats);
        }
        
        this.disable();
        this.projectMonitor.dispose();
        this.statusBarItem.dispose();
        
        console.log('✅ AutoModeController disposed');
    }

    /**
     * Backwards compatibility - alte Methoden
     */
    async enableProjectMode(): Promise<void> {
        await this.enable();
    }

    disableProjectMode(): void {
        this.disable();
    }

    async toggleProjectMode(): Promise<void> {
        await this.toggle();
    }
}
