import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext, AnalysisResult } from '../analysis/codeAnalyzer';
import { LearningSystem } from '../learning/learningSystem';
import { ProjectMonitor } from './projectMonitor';

/**
 * Auto-Mode Controller - Überwacht GESAMTES Projekt automatisch
 */
export class AutoModeController {
    private isEnabled: boolean = false;
    private statusBarItem: vscode.StatusBarItem;
    private projectMonitor: ProjectMonitor;

    constructor(
        private codeAnalyzer: CodeAnalyzer,
        private learningSystem: LearningSystem,
        private context: vscode.ExtensionContext
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.statusBarItem.command = 'voiceDocPlugin.toggleAutoMode';
        this.updateStatusBar();
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);

        // Erstelle Project Monitor
        this.projectMonitor = new ProjectMonitor(codeAnalyzer, learningSystem, context);
    }

    /**
     * Aktiviert Auto-Mode (= Projekt-Überwachung)
     */
    async enable(): Promise<void> {
        if (this.isEnabled) {
            vscode.window.showInformationMessage('🤖 Auto-Modus ist bereits aktiviert');
            return;
        }

        // Bestätigungsdialog
        const confirmation = await vscode.window.showInformationMessage(
            '🔍 Auto-Modus aktivieren?\n\n' +
            '✨ Überwacht ALLE Code-Dateien im Projekt\n' +
            '🆕 Erkennt neue Klassen und Funktionen automatisch\n' +
            '📝 Schlägt Dokumentation vor\n' +
            '🎯 Minimum Konfidenz: ' + (this.getMinConfidence() * 100) + '%\n\n' +
            '⚠️ Bei grossen Projekten kann dies Performance-Auswirkungen haben.',
            { modal: true },
            'Aktivieren',
            'Abbrechen'
        );

        if (confirmation !== 'Aktivieren') {
            return;
        }

        this.isEnabled = true;
        this.projectMonitor.start();
        this.updateStatusBar();
        
        vscode.window.showInformationMessage(
            '🔍 Auto-Modus aktiviert!\n\n' +
            '✨ Projekt wird überwacht\n' +
            '🆕 Neue Klassen werden erkannt\n' +
            '📝 Dokumentations-Vorschläge erscheinen automatisch\n' +
            '💡 Zum Deaktivieren: Ctrl+Shift+A'
        );
    }

    /**
     * Deaktiviert Auto-Mode
     */
    disable(): void {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        this.projectMonitor.stop();
        this.updateStatusBar();
        
        vscode.window.showInformationMessage('Auto-Modus deaktiviert');
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
     * Aktiviert Auto-Mode direkt (ohne Bestätigung)
     */
    enableDirect(): void {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.projectMonitor.start();
        this.updateStatusBar();
    }

    /**
     * Gibt zurück ob Auto-Mode aktiviert ist
     */
    isActive(): boolean {
        return this.isEnabled;
    }

    /**
     * Analysiert die aktuelle Funktion manuell
     */
    async analyzeCurrentFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Kein aktiver Editor');
            return;
        }

        const position = editor.selection.active;
        const codeContext = this.getCodeContext(editor, position);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analysiere Code...',
            cancellable: false
        }, async () => {
            try {
                const analysis = await this.codeAnalyzer.analyzeCode(codeContext);
                await this.suggestDocumentation(analysis, position, codeContext, editor);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Analyse fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
                );
            }
        });
    }

    /**
     * Aktualisiert die Status-Leiste
     */
    private updateStatusBar(): void {
        if (this.isEnabled) {
            this.statusBarItem.text = "$(eye) Auto-Modus";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            this.statusBarItem.tooltip = 
                "Auto-Modus AKTIV\n\n" +
                "✨ Projekt wird überwacht\n" +
                "🆕 Neue Klassen werden erkannt\n" +
                "📝 Automatische Dokumentation\n\n" +
                "Klicken zum Deaktivieren (oder Ctrl+Shift+A)";
        } else {
            this.statusBarItem.text = "$(circle-slash) Auto-Modus";
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = 
                "Auto-Modus deaktiviert\n\n" +
                "Klicken zum Aktivieren (oder Ctrl+Shift+A)";
        }
    }

    /**
     * Erstellt Code-Kontext für Analyse
     */
    private getCodeContext(editor: vscode.TextEditor, position: vscode.Position): CodeContext {
        const document = editor.document;
        const lineCount = document.lineCount;
        
        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(lineCount - 1, position.line + 5);
        
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
        
        const functionRegex = /(?:function|const|let|var|async|def)\s+(\w+)\s*[=\(]/g;
        const classRegex = /class\s+(\w+)/g;
        
        let match;
        let closestFunction: any = { name: 'unknown', type: 'code', distance: Infinity };
        
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
        
        return closestFunction;
    }

    /**
     * Schlägt Dokumentation vor
     */
    private async suggestDocumentation(
        analysis: AnalysisResult,
        position: vscode.Position,
        codeContext: CodeContext,
        editor: vscode.TextEditor
    ): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            `📝 Dokumentation für "${codeContext.functionName}" vorgeschlagen (${Math.round(analysis.confidence * 100)}% Konfidenz)`,
            'Einfügen',
            'Bearbeiten',
            'Ignorieren'
        );

        if (action === 'Einfügen') {
            const comment = this.formatComment(analysis.description, codeContext.languageId);
            await editor.edit(editBuilder => {
                const insertPos = new vscode.Position(position.line, 0);
                editBuilder.insert(insertPos, comment + '\n');
            });

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

        } else if (action === 'Bearbeiten') {
            const edited = await vscode.window.showInputBox({
                prompt: 'Dokumentation bearbeiten',
                value: analysis.description,
                placeHolder: 'Ihre Dokumentation...'
            });

            if (edited) {
                const comment = this.formatComment(edited, codeContext.languageId);
                await editor.edit(editBuilder => {
                    const insertPos = new vscode.Position(position.line, 0);
                    editBuilder.insert(insertPos, comment + '\n');
                });

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
        } else {
            // Ignoriert - negative Feedback
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
     * Cleanup
     */
    dispose(): void {
        this.disable();
        this.projectMonitor.dispose();
        this.statusBarItem.dispose();
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
