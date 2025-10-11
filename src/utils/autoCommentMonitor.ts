import * as vscode from 'vscode';
import { CodeAnalyzer } from '../analysis/codeAnalyzer';
import { CodeElement } from '../types/codeAnalysis';
import { CommentGenerator } from '../generator';
import { ErrorHandler } from './errorHandler';
import { ConfigManager } from './configManager';
import { LearningSystem } from '../learning/learningSystem';

/**
 * Überwacht Code-Änderungen und generiert automatisch Kommentare
 */
export class AutoCommentMonitor {
    private analyzer: CodeAnalyzer | null = null;
    private generator: CommentGenerator;
    private documentChangeListener?: vscode.Disposable;
    private documentSaveListener?: vscode.Disposable;
    private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
    private lastAnalyzedContent: Map<string, string> = new Map();

    constructor(
        generator: CommentGenerator,
        learningSystem?: LearningSystem
    ) {
        this.generator = generator;
        
        // CodeAnalyzer ist optional, nur wenn LearningSystem verfügbar ist
        if (learningSystem) {
            this.analyzer = new CodeAnalyzer(learningSystem);
        }
    }

    /**
     * Startet die Code-Überwachung
     */
    public start(): void {
        if (this.documentChangeListener) {
            return;
        }

        ErrorHandler.log('AutoCommentMonitor', 'Starte Code-Überwachung');

        this.documentSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
            await this.onDocumentSaved(document);
        });

        this.documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            this.onDocumentChanged(event);
        });

        ErrorHandler.log('AutoCommentMonitor', 'Code-Überwachung aktiv', 'success');
    }

    /**
     * Stoppt die Code-Überwachung
     */
    public stop(): void {
        if (this.documentChangeListener) {
            this.documentChangeListener.dispose();
            this.documentChangeListener = undefined;
        }

        if (this.documentSaveListener) {
            this.documentSaveListener.dispose();
            this.documentSaveListener = undefined;
        }

        this.pendingChanges.forEach(timer => clearTimeout(timer));
        this.pendingChanges.clear();

        ErrorHandler.log('AutoCommentMonitor', 'Code-Überwachung gestoppt');
    }

    /**
     * Wird aufgerufen wenn ein Dokument gespeichert wird
     */
    private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
        const mode = ConfigManager.get<string>('autoCommentMode', 'off');
        
        if (mode === 'off' || !this.shouldProcessDocument(document)) {
            return;
        }

        ErrorHandler.log('AutoCommentMonitor', `Analysiere gespeicherte Datei: ${document.fileName}`);

        try {
            await this.analyzeAndComment(document, mode === 'on-save');
        } catch (error) {
            ErrorHandler.handleError('AutoCommentMonitor.onDocumentSaved', error, false);
        }
    }

    /**
     * Wird aufgerufen wenn ein Dokument geändert wird
     */
    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        const mode = ConfigManager.get<string>('autoCommentMode', 'off');
        
        if (mode !== 'on-type' || !this.shouldProcessDocument(event.document)) {
            return;
        }

        const uri = event.document.uri.toString();
        
        if (this.pendingChanges.has(uri)) {
            clearTimeout(this.pendingChanges.get(uri)!);
        }

        const timer = setTimeout(() => {
            this.analyzeAndComment(event.document, false);
            this.pendingChanges.delete(uri);
        }, 2000);

        this.pendingChanges.set(uri, timer);
    }

    /**
     * Prüft ob ein Dokument verarbeitet werden soll
     */
    private shouldProcessDocument(document: vscode.TextDocument): boolean {
        const supportedLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
        
        if (!supportedLanguages.includes(document.languageId)) {
            return false;
        }

        if (document.uri.scheme !== 'file') {
            return false;
        }

        if (document.fileName.includes('node_modules')) {
            return false;
        }

        return true;
    }

    /**
     * Analysiert Dokument und fügt fehlende Kommentare hinzu
     */
    private async analyzeAndComment(document: vscode.TextDocument, showNotification: boolean): Promise<void> {
        const uri = document.uri.toString();
        const currentContent = document.getText();
        const lastContent = this.lastAnalyzedContent.get(uri);

        if (lastContent === currentContent) {
            return;
        }

        this.lastAnalyzedContent.set(uri, currentContent);

        // Einfache Syntax-Analyse
        const elements = this.simpleCodeAnalysis(currentContent, document.languageId);
        
        // Filter undokumentierte Elemente
        const uncommentedElements = elements.filter((el: CodeElement) => {
            // Prüfe ob Element bereits einen Kommentar hat (vereinfachte Prüfung)
            const lineAbove = el.startLine > 0 ? document.lineAt(el.startLine - 1).text : '';
            return !lineAbove.trim().startsWith('//') && !lineAbove.trim().startsWith('/*');
        });

        if (uncommentedElements.length === 0) {
            return;
        }

        ErrorHandler.log(
            'AutoCommentMonitor',
            `Gefunden: ${uncommentedElements.length} undokumentierte Code-Elemente`
        );

        const minComplexity = ConfigManager.get<number>('autoCommentMinComplexity', 3) || 3;
        const elementsToComment = uncommentedElements.filter((el: CodeElement) => 
            (el.complexity || 0) >= minComplexity
        );

        if (elementsToComment.length === 0) {
            return;
        }

        const action = await this.askUserForAction(elementsToComment.length);

        if (action === 'comment-all') {
            await this.commentAllElements(document, elementsToComment);
            if (showNotification) {
                vscode.window.showInformationMessage(
                    `✅ ${elementsToComment.length} Kommentare automatisch hinzugefügt`
                );
            }
        } else if (action === 'review') {
            await this.reviewElements(document, elementsToComment);
        }
    }

    /**
     * Einfache Code-Analyse
     */
    private simpleCodeAnalysis(content: string, languageId: string): CodeElement[] {
        const elements: CodeElement[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Funktionen
            const funcMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+(\w+)/);
            if (funcMatch) {
                elements.push({
                    type: 'function',
                    name: funcMatch[3],
                    startLine: i,
                    endLine: i,
                    complexity: 5
                });
            }

            // Klassen
            const classMatch = line.match(/^\s*(export\s+)?class\s+(\w+)/);
            if (classMatch) {
                elements.push({
                    type: 'class',
                    name: classMatch[2],
                    startLine: i,
                    endLine: i,
                    complexity: 10
                });
            }

            // Methoden
            const methodMatch = line.match(/^\s*(public|private|protected)?\s*(\w+)\s*\(/);
            if (methodMatch && !funcMatch) {
                elements.push({
                    type: 'method',
                    name: methodMatch[2],
                    startLine: i,
                    endLine: i,
                    complexity: 5
                });
            }
        }

        return elements;
    }

    /**
     * Fragt Benutzer nach Aktion
     */
    private async askUserForAction(count: number): Promise<string> {
        const autoApprove = ConfigManager.get<boolean>('autoCommentAutoApprove', false);
        
        if (autoApprove) {
            return 'comment-all';
        }

        const action = await vscode.window.showInformationMessage(
            `🤖 ${count} undokumentierte Code-Elemente gefunden`,
            'Alle kommentieren',
            'Einzeln durchgehen',
            'Ignorieren'
        );

        if (action === 'Alle kommentieren') {
            return 'comment-all';
        } else if (action === 'Einzeln durchgehen') {
            return 'review';
        }

        return 'ignore';
    }

    /**
     * Kommentiert alle Elemente automatisch
     */
    private async commentAllElements(document: vscode.TextDocument, elements: CodeElement[]): Promise<void> {
        const editor = await vscode.window.showTextDocument(document);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generiere Kommentare...',
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                progress.report({
                    message: `${i + 1}/${elements.length} - ${element.name}`,
                    increment: (100 / elements.length)
                });

                await this.addCommentForElement(editor, element);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });

        ErrorHandler.log('AutoCommentMonitor', `${elements.length} Kommentare hinzugefügt`, 'success');
    }

    /**
     * Lässt Benutzer Elemente einzeln durchgehen
     */
    private async reviewElements(document: vscode.TextDocument, elements: CodeElement[]): Promise<void> {
        const editor = await vscode.window.showTextDocument(document);

        for (const element of elements) {
            const position = new vscode.Position(element.startLine, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            const comment = await this.generateCommentForElement(element);
            
            const action = await vscode.window.showInformationMessage(
                `${element.type} "${element.name}":\n\n${comment}\n\nKommentar hinzufügen?`,
                { modal: true },
                'Ja',
                'Bearbeiten',
                'Überspringen',
                'Abbrechen'
            );

            if (action === 'Ja') {
                await this.insertComment(editor, position, comment);
            } else if (action === 'Bearbeiten') {
                const edited = await vscode.window.showInputBox({
                    prompt: 'Kommentar bearbeiten',
                    value: comment
                });
                if (edited) {
                    await this.insertComment(editor, position, edited);
                }
            } else if (action === 'Abbrechen') {
                break;
            }
        }
    }

    /**
     * Fügt Kommentar für ein Element hinzu
     */
    private async addCommentForElement(editor: vscode.TextEditor, element: CodeElement): Promise<void> {
        const comment = await this.generateCommentForElement(element);
        const position = new vscode.Position(element.startLine, 0);
        await this.insertComment(editor, position, comment);
    }

    /**
     * Generiert Kommentar für ein Code-Element
     */
    private async generateCommentForElement(element: CodeElement): Promise<string> {
        const codeDescription = this.generateCodeDescription(element);
        
        const useAI = ConfigManager.get<boolean>('autoCommentUseAI', true) && 
                      this.generator.isOpenAIAvailable();

        if (useAI) {
            try {
                const prompt = this.buildAIPrompt(element, codeDescription);
                const aiComment = await this.generator.enhanceWithOpenAI(prompt, codeDescription);
                return this.generator.formatComment(aiComment, 'typescript');
            } catch (error) {
                ErrorHandler.log('AutoCommentMonitor', 'KI-Generierung fehlgeschlagen, verwende Standard');
            }
        }

        return this.generateStandardComment(element);
    }

    /**
     * Generiert Code-Beschreibung für Element
     */
    private generateCodeDescription(element: CodeElement): string {
        const parts: string[] = [`${element.type} ${element.name}`];
        
        if (element.parameters && element.parameters.length > 0) {
            parts.push(`mit ${element.parameters.length} Parametern`);
        }
        
        if (element.returnType) {
            parts.push(`gibt ${element.returnType} zurück`);
        }
        
        return parts.join(', ');
    }

    /**
     * Erstellt KI-Prompt für Code-Element
     */
    private buildAIPrompt(element: CodeElement, description: string): string {
        return `Erstelle einen professionellen JSDoc-Kommentar für dieses ${element.type}:\n\n${description}\n\nDer Kommentar soll beschreiben was der Code macht, nicht wie er es macht.`;
    }

    /**
     * Generiert Standard-Kommentar ohne KI
     */
    private generateStandardComment(element: CodeElement): string {
        const parts: string[] = [];

        switch (element.type) {
            case 'function':
                parts.push(`Funktion ${element.name}`);
                if (element.parameters && element.parameters.length > 0) {
                    parts.push(`@param ${element.parameters.map(p => p.name).join(', ')}`);
                }
                if (element.returnType && element.returnType !== 'void') {
                    parts.push(`@returns ${element.returnType}`);
                }
                break;

            case 'class':
                parts.push(`Klasse ${element.name}`);
                if (element.methods && element.methods.length > 0) {
                    parts.push(`Methoden: ${element.methods.slice(0, 3).map(m => m.name).join(', ')}`);
                }
                break;

            case 'method':
                parts.push(`Methode ${element.name}`);
                if (element.parameters && element.parameters.length > 0) {
                    parts.push(`@param ${element.parameters.map(p => p.name).join(', ')}`);
                }
                break;
        }

        return this.generator.formatComment(parts.join('\n'), 'typescript');
    }

    /**
     * Fügt Kommentar an Position ein
     */
    private async insertComment(
        editor: vscode.TextEditor,
        position: vscode.Position,
        comment: string
    ): Promise<void> {
        const line = editor.document.lineAt(position.line);
        const indentation = line.firstNonWhitespaceCharacterIndex;
        const indent = ' '.repeat(Math.max(0, indentation));

        await editor.edit(editBuilder => {
            editBuilder.insert(
                new vscode.Position(position.line, 0),
                indent + comment + '\n'
            );
        });
    }

    /**
     * Gibt Statistiken zurück
     */
    public getStatistics(): AutoCommentStatistics {
        return {
            isActive: !!this.documentChangeListener,
            monitoredDocuments: this.lastAnalyzedContent.size,
            pendingAnalyses: this.pendingChanges.size
        };
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        this.stop();
        this.lastAnalyzedContent.clear();
    }
}

/**
 * Statistiken für Auto-Comment-Monitor
 */
export interface AutoCommentStatistics {
    isActive: boolean;
    monitoredDocuments: number;
    pendingAnalyses: number;
}
