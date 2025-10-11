import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext, AnalysisResult } from '../analysis/codeAnalyzer';
import { LearningSystem } from '../learning/learningSystem';

export class AutoModeController {
    private documentChangeListener?: vscode.Disposable;
    private analysisTimeout?: NodeJS.Timeout;
    private isEnabled: boolean = false;
    private statusBarItem: vscode.StatusBarItem;

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
    }

    enable(): void {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.startMonitoring();
        this.updateStatusBar();
        vscode.window.showInformationMessage('🤖 Auto-Modus aktiviert - Code wird automatisch analysiert');
    }

    disable(): void {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        this.stopMonitoring();
        this.updateStatusBar();
        vscode.window.showInformationMessage('Auto-Modus deaktiviert');
    }

    toggle(): void {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    async analyzeCurrentFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Kein aktiver Editor');
            return;
        }

        const position = editor.selection.active;
        const codeContext = this.getCodeContext(editor, position);

        vscode.window.showInformationMessage('Analysiere Code...');

        try {
            const analysis = await this.codeAnalyzer.analyzeCode(codeContext);
            await this.suggestDocumentation(analysis, position, codeContext, editor);
        } catch (error) {
            vscode.window.showErrorMessage(`Analyse fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
        }
    }

    private updateStatusBar(): void {
        if (this.isEnabled) {
            this.statusBarItem.text = "$(robot) Auto-Modus";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = "Auto-Modus aktiviert - Klicken zum Deaktivieren";
        } else {
            this.statusBarItem.text = "$(circle-slash) Auto-Modus";
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = "Auto-Modus deaktiviert - Klicken zum Aktivieren";
        }
    }

    private startMonitoring(): void {
        if (this.documentChangeListener) return;

        this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (!this.isEnabled) return;
            
            const editor = vscode.window.activeTextEditor;
            if (!editor || event.document !== editor.document) return;

            clearTimeout(this.analysisTimeout);
            this.analysisTimeout = setTimeout(async () => {
                await this.autoAnalyzeCode(editor, event);
            }, 3000);
        });

        this.context.subscriptions.push(this.documentChangeListener);
    }

    private stopMonitoring(): void {
        if (this.documentChangeListener) {
            this.documentChangeListener.dispose();
            this.documentChangeListener = undefined;
        }
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }
    }

    private async autoAnalyzeCode(
        editor: vscode.TextEditor,
        event: vscode.TextDocumentChangeEvent
    ): Promise<void> {
        try {
            const changes = event.contentChanges;
            if (changes.length === 0) return;

            const lastChange = changes[changes.length - 1];
            const newText = lastChange.text;

            if (this.isNewFunctionOrClass(newText)) {
                const position = lastChange.range.start;
                const codeContext = this.getCodeContext(editor, position);

                if (this.isAlreadyDocumented(editor.document, position)) {
                    return;
                }

                const analysis = await this.codeAnalyzer.analyzeCode(codeContext);

                if (analysis.confidence >= this.getMinConfidence()) {
                    await this.suggestDocumentation(analysis, position, codeContext, editor);
                }
            }

        } catch (error) {
            console.error('Auto-Analyse Fehler:', error);
        }
    }

    private isNewFunctionOrClass(text: string): boolean {
        const patterns = [
            /function\s+\w+\s*\(/,
            /const\s+\w+\s*=\s*(?:async\s*)?\(/,
            /class\s+\w+/,
            /def\s+\w+\s*\(/,  // Python
            /=>\s*\{/
        ];
        
        return patterns.some(pattern => pattern.test(text));
    }

    private isAlreadyDocumented(document: vscode.TextDocument, position: vscode.Position): boolean {
        const line = position.line;
        if (line === 0) return false;

        const previousLine = document.lineAt(line - 1).text.trim();
        return previousLine.startsWith('/*') || 
               previousLine.startsWith('//') ||
               previousLine.startsWith('*') ||
               previousLine.startsWith('#');  // Python
    }

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

            setTimeout(() => this.requestFeedback(comment, analysis.description, codeContext), 2000);

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

    private async requestFeedback(_comment: string, originalText: string, codeContext: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        const learningEnabled = config.get('learningEnabled', true);
        
        if (!learningEnabled) return;

        const feedback = await vscode.window.showInformationMessage(
            'War die Dokumentation hilfreich?',
            '👍 Gut',
            '👎 Verbesserungswürdig'
        );

        if (feedback) {
            if (feedback === '👎 Verbesserungswürdig') {
                const improvement = await vscode.window.showInputBox({
                    prompt: 'Wie könnte die Dokumentation verbessert werden?',
                    placeHolder: 'Ihre Verbesserungsvorschläge...'
                });

                if (improvement) {
                    // Speichere negatives Feedback mit Verbesserung
                    this.learningSystem.addTrainingExample({
                        input: originalText,
                        output: improvement,
                        codeContext: codeContext,
                        source: 'feedback',
                        timestamp: Date.now()
                    });
                }
            }
        }
    }

    private formatComment(text: string, languageId: string): string {
        // Formatiere basierend auf Sprache
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

    private getMinConfidence(): number {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        return config.get('minConfidence', 0.7);
    }
}
