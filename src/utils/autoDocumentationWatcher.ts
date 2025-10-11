import * as vscode from 'vscode';
import { CodeParser, CodeBlock } from './codeParser';
import { AICodeAnalyzer } from './aiCodeAnalyzer';
import { CommentGenerator } from '../generator';
import { ConfigManager } from './configManager';
import { ErrorHandler } from './errorHandler';

/**
 * Überwacht Code-Änderungen und schlägt automatisch Dokumentation vor
 */
export class AutoDocumentationWatcher {
    private analyzer: AICodeAnalyzer;
    private generator: CommentGenerator;
    private documentationCache: Map<string, Map<string, string>>;
    private changeTimeout: NodeJS.Timeout | null = null;
    private decorationType: vscode.TextEditorDecorationType;
    private disposables: vscode.Disposable[] = [];

    constructor(generator: CommentGenerator) {
        this.analyzer = new AICodeAnalyzer();
        this.generator = generator;
        this.documentationCache = new Map();

        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            isWholeLine: true,
            overviewRulerColor: 'rgba(255, 193, 7, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                contentText: ' 💡 Dokumentation fehlt',
                color: 'rgba(255, 193, 7, 0.8)',
                margin: '0 0 0 20px'
            }
        });
    }

    /**
     * Startet die Überwachung
     */
    activate(context: vscode.ExtensionContext): void {
        const isEnabled = ConfigManager.get<boolean>('autoDocumentation.enabled', false);
        
        if (!isEnabled) {
            return;
        }

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                this.onDocumentChange(e);
            })
        );

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.analyzeDocument(editor.document);
                }
            })
        );

        this.disposables.push(
            vscode.commands.registerCommand('voiceDocPlugin.documentCurrentBlock', async () => {
                await this.documentCurrentBlock();
            })
        );

        this.disposables.push(
            vscode.commands.registerCommand('voiceDocPlugin.documentAllUndocumented', async () => {
                await this.documentAllUndocumented();
            })
        );

        if (vscode.window.activeTextEditor) {
            this.analyzeDocument(vscode.window.activeTextEditor.document);
        }

        ErrorHandler.log('AutoDocWatcher', 'Automatische Dokumentation aktiviert', 'success');
    }

    /**
     * Reagiert auf Dokument-Änderungen
     */
    private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (this.changeTimeout) {
            clearTimeout(this.changeTimeout);
        }

        this.changeTimeout = setTimeout(() => {
            this.analyzeDocument(event.document);
        }, 2000);
    }

    /**
     * Analysiert ein Dokument auf undokumentierte Code-Blöcke
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        if (!this.shouldAnalyzeDocument(document)) {
            return;
        }

        try {
            const undocumented = CodeParser.getUndocumentedBlocks(document);

            if (undocumented.length === 0) {
                this.clearDecorations(document);
                return;
            }

            this.highlightUndocumented(document, undocumented);

            const shouldAutoGenerate = ConfigManager.get<boolean>(
                'autoDocumentation.autoGenerate',
                false
            );

            if (shouldAutoGenerate && undocumented.length <= 3) {
                await this.generateDocumentationForBlocks(document, undocumented);
            }

        } catch (error) {
            ErrorHandler.handleError('AutoDocWatcher', error, false);
        }
    }

    /**
     * Prüft ob ein Dokument analysiert werden soll
     */
    private shouldAnalyzeDocument(document: vscode.TextDocument): boolean {
        const supportedLanguages = [
            'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
            'python', 'java', 'csharp', 'cpp', 'c', 'go', 'rust', 'php'
        ];

        return (
            !document.isUntitled &&
            supportedLanguages.includes(document.languageId) &&
            document.uri.scheme === 'file'
        );
    }

    /**
     * Markiert undokumentierte Code-Blöcke
     */
    private highlightUndocumented(document: vscode.TextDocument, blocks: CodeBlock[]): void {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor || editor.document !== document) {
            return;
        }

        const decorations: vscode.DecorationOptions[] = blocks.map(block => ({
            range: block.range,
            hoverMessage: `**Undokumentiert**: ${block.type} \`${block.name}\`\n\nKlicke auf die Glühbirne oder verwende Code-Actions (Ctrl+.)`,
        }));

        editor.setDecorations(this.decorationType, decorations);
    }

    /**
     * Entfernt Markierungen
     */
    private clearDecorations(document: vscode.TextDocument): void {
        const editor = vscode.window.activeTextEditor;
        
        if (editor && editor.document === document) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    /**
     * Generiert Dokumentation für Code-Blöcke
     */
    private async generateDocumentationForBlocks(
        document: vscode.TextDocument,
        blocks: CodeBlock[]
    ): Promise<void> {
        const cacheKey = document.uri.toString();
        
        if (!this.documentationCache.has(cacheKey)) {
            this.documentationCache.set(cacheKey, new Map());
        }

        const cache = this.documentationCache.get(cacheKey)!;

        for (const block of blocks) {
            const blockKey = `${block.type}:${block.name}:${block.range.start.line}`;
            
            if (!cache.has(blockKey)) {
                const context = this.getContext(document, block);
                const documentation = await this.analyzer.analyzeAndDocument(
                    block,
                    context,
                    document.languageId
                );
                
                cache.set(blockKey, documentation);
            }
        }
    }

    /**
     * Dokumentiert den aktuellen Code-Block
     */
    private async documentCurrentBlock(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showWarningMessage('Kein aktiver Editor');
            return;
        }

        const position = editor.selection.active;
        const blocks = CodeParser.parseDocument(editor.document);
        
        const currentBlock = blocks.find(block =>
            block.range.start.line <= position.line &&
            block.range.end.line >= position.line
        );

        if (!currentBlock) {
            vscode.window.showInformationMessage('Kein Code-Block an aktueller Position gefunden');
            return;
        }

        if (currentBlock.hasDocumentation) {
            vscode.window.showInformationMessage(`${currentBlock.type} "${currentBlock.name}" ist bereits dokumentiert`);
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analysiere ${currentBlock.name}...`,
            cancellable: false
        }, async () => {
            const context = this.getContext(editor.document, currentBlock);
            const documentation = await this.analyzer.analyzeAndDocument(
                currentBlock,
                context,
                editor.document.languageId
            );

            const comment = this.generator.formatComment(documentation, editor.document.languageId);

            const insertLine = currentBlock.range.start.line;
            const lineText = editor.document.lineAt(insertLine).text;
            const indentation = lineText.match(/^\s*/)?.[0] || '';

            await editor.edit(editBuilder => {
                editBuilder.insert(
                    new vscode.Position(insertLine, 0),
                    indentation + comment + '\n'
                );
            });

            vscode.window.showInformationMessage(`✅ Dokumentation für "${currentBlock.name}" hinzugefügt`);
        });
    }

    /**
     * Dokumentiert alle undokumentierten Blöcke
     */
    private async documentAllUndocumented(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showWarningMessage('Kein aktiver Editor');
            return;
        }

        const undocumented = CodeParser.getUndocumentedBlocks(editor.document);

        if (undocumented.length === 0) {
            vscode.window.showInformationMessage('✅ Alle Code-Blöcke sind bereits dokumentiert!');
            return;
        }

        const action = await vscode.window.showInformationMessage(
            `${undocumented.length} undokumentierte Code-Blöcke gefunden. Alle dokumentieren?`,
            { modal: true },
            'Ja, alle dokumentieren',
            'Nur erste 5',
            'Abbrechen'
        );

        if (!action || action === 'Abbrechen') {
            return;
        }

        const blocksToDocument = action === 'Nur erste 5' 
            ? undocumented.slice(0, 5) 
            : undocumented;

        const results = await this.analyzer.analyzeBatch(
            blocksToDocument,
            editor.document,
            blocksToDocument.length
        );

        let insertedCount = 0;

        await editor.edit(editBuilder => {
            results.forEach((documentation, block) => {
                const comment = this.generator.formatComment(documentation, editor.document.languageId);
                const insertLine = block.range.start.line + insertedCount;
                const lineText = editor.document.lineAt(insertLine).text;
                const indentation = lineText.match(/^\s*/)?.[0] || '';

                editBuilder.insert(
                    new vscode.Position(insertLine, 0),
                    indentation + comment + '\n'
                );

                insertedCount++;
            });
        });

        vscode.window.showInformationMessage(
            `✅ ${insertedCount} Dokumentationen hinzugefügt!`
        );
    }

    /**
     * Holt Kontext für einen Code-Block
     */
    private getContext(document: vscode.TextDocument, block: CodeBlock): string {
        const startLine = Math.max(0, block.range.start.line - 3);
        const endLine = Math.min(document.lineCount - 1, block.range.end.line + 10);

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
        }

        return lines.join('\n');
    }

    /**
     * Aktiviert/Deaktiviert die automatische Dokumentation
     */
    async toggle(): Promise<void> {
        const current = ConfigManager.get<boolean>('autoDocumentation.enabled', false);
        await ConfigManager.set('autoDocumentation.enabled', !current);

        if (!current) {
            vscode.window.showInformationMessage(
                '✅ Automatische Dokumentation aktiviert!\n\n' +
                'Undokumentierte Code-Blöcke werden jetzt markiert.'
            );
            
            if (vscode.window.activeTextEditor) {
                this.analyzeDocument(vscode.window.activeTextEditor.document);
            }
        } else {
            vscode.window.showInformationMessage('Automatische Dokumentation deaktiviert');
            
            if (vscode.window.activeTextEditor) {
                this.clearDecorations(vscode.window.activeTextEditor.document);
            }
        }
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.decorationType.dispose();
        
        if (this.changeTimeout) {
            clearTimeout(this.changeTimeout);
        }
    }
}
