import * as vscode from 'vscode';
import { CommentGenerator } from './generator';

/**
 * IntegratedVoiceHandler - Verwaltet Audio-Aufnahme und Verarbeitung
 */
export class IntegratedVoiceHandler {
    private generator: CommentGenerator;
    private _isRecording: boolean = false;
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private simulationTimer: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext, generator: CommentGenerator) {
        this.context = context;
        this.generator = generator;
        this.outputChannel = vscode.window.createOutputChannel('Voice Documentation');
    }

    /**
     * Gibt zurück ob gerade aufgenommen wird
     */
    public isRecording(): boolean {
        return this._isRecording;
    }

    /**
     * Toggle Aufnahme
     */
    public async toggleRecording(): Promise<void> {
        if (this._isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    /**
     * Startet die Aufnahme
     */
    public async startRecording(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Bitte öffnen Sie eine Datei.');
                return;
            }

            this._isRecording = true;
            vscode.window.showInformationMessage('🎤 Aufnahme gestartet (3 Sekunden)...');
            this.log('Aufnahme gestartet');

            // Simuliere 3-Sekunden Aufnahme
            this.simulationTimer = setTimeout(async () => {
                if (this._isRecording) {
                    await this.stopRecording();
                    await this.processSimulatedRecording();
                }
            }, 3000);

        } catch (error) {
            this.handleError('Fehler beim Starten', error);
        }
    }

    /**
     * Stoppt die Aufnahme
     */
    public async stopRecording(): Promise<void> {
        try {
            if (this.simulationTimer) {
                clearTimeout(this.simulationTimer);
                this.simulationTimer = null;
            }

            this._isRecording = false;
            vscode.window.showInformationMessage('⏹️ Aufnahme gestoppt.');
            this.log('Aufnahme gestoppt');

        } catch (error) {
            this.handleError('Fehler beim Stoppen', error);
        }
    }

    /**
     * Verarbeitet simulierte Aufnahme
     */
    private async processSimulatedRecording(): Promise<void> {
        const simulatedTexts = [
            'Diese Funktion berechnet die Fibonacci-Zahlen rekursiv',
            'Hier wird die Datenbankverbindung initialisiert',
            'Diese Methode validiert die Benutzereingaben',
            'Der Algorithmus sortiert die Liste mit QuickSort',
            'Diese Klasse implementiert das Singleton-Pattern'
        ];
        
        const text = simulatedTexts[Math.floor(Math.random() * simulatedTexts.length)];
        await this.processTranscribedText(text);
    }

    /**
     * Verarbeitet transkribierten Text
     */
    private async processTranscribedText(text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            vscode.window.showWarningMessage('Keine Sprache erkannt.');
            return;
        }

        this.log(`Erkannter Text: "${text}"`);

        const action = await vscode.window.showInformationMessage(
            `Erkannter Text: "${text}"`,
            'Einfügen',
            'Mit KI verbessern',
            'Bearbeiten',
            'Abbrechen'
        );

        switch (action) {
            case 'Einfügen':
                await this.insertComment(text);
                break;
            case 'Mit KI verbessern':
                await this.enhanceAndInsertComment(text);
                break;
            case 'Bearbeiten':
                await this.editAndInsertComment(text);
                break;
        }
    }

    /**
     * Verarbeitet Voice Input (öffentliche Methode)
     */
    public async processVoiceInput(text: string): Promise<string> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('Kein aktiver Editor');
        }

        const languageId = editor.document.languageId;
        
        if (this.generator.isOpenAIAvailable()) {
            const codeContext = this.getCodeContext(editor);
            return await this.generator.generateContextualComment(text, codeContext);
        } else {
            return this.generator.formatComment(text, languageId);
        }
    }

    /**
     * Fügt Kommentar ein
     */
    private async insertComment(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const comment = await this.processVoiceInput(text);
            await this.insertCommentAtPosition(editor, comment);
            vscode.window.showInformationMessage('✅ Kommentar eingefügt!');
            this.log(`Kommentar eingefügt: "${comment}"`);
        } catch (error) {
            this.handleError('Fehler beim Einfügen', error);
        }
    }

    /**
     * Verbessert mit KI und fügt ein
     */
    private async enhanceAndInsertComment(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const codeContext = this.getCodeContext(editor);
            const enhancedText = await this.generator.enhanceWithOpenAI(text, codeContext);
            const comment = this.generator.formatComment(enhancedText, editor.document.languageId);
            
            await this.insertCommentAtPosition(editor, comment);
            vscode.window.showInformationMessage('✅ KI-verbesserter Kommentar eingefügt!');
            this.log(`KI-Kommentar: "${comment}"`);
        } catch (error) {
            this.log('KI-Verbesserung fehlgeschlagen, verwende Original');
            await this.insertComment(text);
        }
    }

    /**
     * Bearbeiten und einfügen
     */
    private async editAndInsertComment(text: string): Promise<void> {
        const editedText = await vscode.window.showInputBox({
            prompt: 'Kommentar bearbeiten',
            value: text,
            validateInput: (value) => {
                return value.trim().length === 0 ? 'Darf nicht leer sein' : null;
            }
        });

        if (editedText) {
            await this.insertComment(editedText);
        }
    }

    /**
     * Fügt Kommentar an Position ein
     */
    private async insertCommentAtPosition(editor: vscode.TextEditor, comment: string): Promise<void> {
        const position = editor.selection.active;
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
     * Holt Code-Kontext
     */
    private getCodeContext(editor: vscode.TextEditor): string {
        const position = editor.selection.active;
        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(editor.document.lineCount - 1, position.line + 5);
        
        const lines = [];
        for (let i = startLine; i <= endLine; i++) {
            lines.push(editor.document.lineAt(i).text);
        }
        
        return lines.join('\n');
    }

    /**
     * Logging
     */
    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Error Handling
     */
    private handleError(message: string, error: any): void {
        console.error(message, error);
        this.log(`ERROR: ${message} - ${error}`);
        vscode.window.showErrorMessage(`${message}: ${error}`);
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        if (this.simulationTimer) {
            clearTimeout(this.simulationTimer);
        }
        this.outputChannel.dispose();
    }
}