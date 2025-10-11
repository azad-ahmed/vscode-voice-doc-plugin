import * as vscode from 'vscode';
import { CommentGenerator } from './generator';
import { AudioRecorder } from './audio/recorder';
import { STTFactory } from './stt/factory';
import { STTProvider } from './stt/types';
import { ErrorHandler } from './utils/errorHandler';
import { ConfigManager } from './utils/configManager';

/**
 * IntegratedVoiceHandler - Verwaltet Audio-Aufnahme und Verarbeitung
 * VERBESSERTE VERSION mit besserer Fehlerbehandlung und Race Condition Fixes
 */
export class IntegratedVoiceHandler {
    private generator: CommentGenerator;
    private recorder: AudioRecorder;
    private sttProvider: STTProvider | null = null;
    private _isRecording: boolean = false;
    private context: vscode.ExtensionContext;
    private maxRecordingTimeMs: number = 30000; // 30 Sekunden
    private recordingTimer: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext, generator: CommentGenerator) {
        this.context = context;
        this.generator = generator;
        this.recorder = new AudioRecorder();
        
        // Initialisiere STT Provider
        this.initializeSTTProvider();
    }

    /**
     * Initialisiert den STT Provider
     */
    private async initializeSTTProvider(): Promise<void> {
        try {
            this.sttProvider = await STTFactory.createBestAvailableProvider();
            ErrorHandler.log('VoiceHandler', `STT Provider geladen: ${this.sttProvider.name}`, 'success');
            
            vscode.window.showInformationMessage(
                `✅ Voice Doc bereit mit ${this.sttProvider.name}`
            );
        } catch (error: any) {
            ErrorHandler.handleWarning(
                'VoiceHandler',
                'Kein STT-Provider verfügbar. Bitte konfiguriere OpenAI oder Azure.',
                true
            );
            
            const action = await vscode.window.showWarningMessage(
                '⚠️ Kein STT-Provider verfügbar.',
                'OpenAI konfigurieren',
                'Azure konfigurieren',
                'Demo-Modus'
            );
            
            if (action === 'OpenAI konfigurieren') {
                vscode.commands.executeCommand('voiceDocPlugin.configureOpenAI');
            } else if (action === 'Azure konfigurieren') {
                vscode.commands.executeCommand('voiceDocPlugin.configureAzure');
            } else if (action === 'Demo-Modus') {
                vscode.commands.executeCommand('voiceDocPlugin.enableDemoMode');
            }
        }
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

            if (!this.sttProvider) {
                vscode.window.showErrorMessage(
                    'Kein STT-Provider verfügbar. Bitte konfiguriere OpenAI oder Azure.'
                );
                return;
            }

            // Starte Audio-Aufnahme
            await this.recorder.start();
            this._isRecording = true;

            // Auto-Stop Timer
            this.recordingTimer = setTimeout(() => {
                if (this._isRecording) {
                    ErrorHandler.log('VoiceHandler', 'Auto-stopping recording after 30 seconds');
                    this.stopRecording();
                }
            }, this.maxRecordingTimeMs);

            vscode.window.showInformationMessage('🎤 Aufnahme läuft... (Max 30 Sek.)');
            ErrorHandler.log('VoiceHandler', 'Aufnahme gestartet', 'success');

        } catch (error: any) {
            this._isRecording = false; // FIX: Reset status on error
            ErrorHandler.handleError('startRecording', error);
        }
    }

    /**
     * Stoppt die Aufnahme
     * FIX: Verbesserte Fehlerbehandlung mit Finally-Block
     */
    public async stopRecording(): Promise<void> {
        if (!this._isRecording) {
            return;
        }

        // Cancel auto-stop timer
        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
            this.recordingTimer = null;
        }

        let audioPath: string | null = null;

        try {
            // Stoppe Aufnahme und hole Dateipfad
            audioPath = await this.recorder.stop();
            
            vscode.window.showInformationMessage('⏹️ Aufnahme gestoppt. Transkribiere...');
            ErrorHandler.log('VoiceHandler', `Aufnahme gespeichert: ${audioPath}`, 'success');

            // Transkribiere mit Progress-Anzeige
            await this.transcribeAndProcess(audioPath);

        } catch (error: any) {
            ErrorHandler.handleError('stopRecording', error);
        } finally {
            // FIX: Garantiere dass Status zurückgesetzt wird
            this._isRecording = false;
        }
    }

    /**
     * Transkribiert Audio und verarbeitet das Ergebnis
     * FIX: Verbesserte Promise-Handhabung ohne Race Conditions
     */
    private async transcribeAndProcess(audioPath: string): Promise<void> {
        if (!this.sttProvider) {
            throw new Error('Kein STT-Provider verfügbar');
        }

        try {
            // Zeige Progress - und warte darauf
            const text = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Transkribiere Aufnahme...',
                cancellable: false
            }, async (progress) => {
                const language = ConfigManager.get<string>('language', 'de-DE');
                
                const startTime = Date.now();
                
                // FIX: Nutze Retry-Mechanismus
                const transcribedText = await ErrorHandler.retry(
                    () => this.sttProvider!.transcribe(audioPath, language),
                    {
                        maxRetries: 2,
                        initialDelay: 1000,
                        context: 'STT Transcription'
                    }
                );
                
                const duration = Date.now() - startTime;

                ErrorHandler.log('VoiceHandler', `Transkription erfolgreich in ${duration}ms`, 'success');
                ErrorHandler.log('VoiceHandler', `Text: "${transcribedText}"`);

                return transcribedText;
            });

            // FIX: Warte bis Progress Dialog geschlossen ist
            // Nutze kleineren Delay aber mit Promise
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verarbeite das Ergebnis
            await this.processTranscribedText(text);

        } catch (error: any) {
            ErrorHandler.handleError('transcribeAndProcess', error);
            
            // Biete Fallback an
            const retry = await vscode.window.showErrorMessage(
                `Transkription fehlgeschlagen: ${error.message}`,
                'Erneut versuchen',
                'Text manuell eingeben',
                'Abbrechen'
            );

            if (retry === 'Erneut versuchen') {
                await this.transcribeAndProcess(audioPath);
            } else if (retry === 'Text manuell eingeben') {
                const manualText = await vscode.window.showInputBox({
                    prompt: 'Text manuell eingeben',
                    placeHolder: 'Was soll dokumentiert werden?'
                });
                
                if (manualText) {
                    await this.processTranscribedText(manualText);
                }
            }
        }
    }

    /**
     * Verarbeitet transkribierten Text
     */
    private async processTranscribedText(text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            vscode.window.showWarningMessage('Keine Sprache erkannt.');
            return;
        }

        ErrorHandler.log('VoiceHandler', `Erkannter Text: "${text}"`);

        // Zeige Optionen als NICHT-MODAL Dialog (besser für UX)
        const action = await vscode.window.showInformationMessage(
            `🎙️ Erkannter Text:\n\n"${text}"\n\nWas möchtest du tun?`,
            { modal: false },
            'Einfügen',
            'Mit KI verbessern',
            'Bearbeiten',
            'Abbrechen'
        );

        ErrorHandler.log('VoiceHandler', `Benutzer wählte: ${action || 'Abgebrochen'}`);

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
            default:
                ErrorHandler.log('VoiceHandler', 'Benutzer hat abgebrochen');
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
            ErrorHandler.log('VoiceHandler', `Kommentar eingefügt: "${comment}"`, 'success');
        } catch (error) {
            ErrorHandler.handleError('insertComment', error);
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
            
            // Nutze Retry-Mechanismus für API Call
            const enhancedText = await ErrorHandler.retry(
                () => this.generator.enhanceWithOpenAI(text, codeContext),
                {
                    maxRetries: 2,
                    initialDelay: 1000,
                    context: 'OpenAI Enhancement'
                }
            );
            
            const comment = this.generator.formatComment(enhancedText, editor.document.languageId);
            
            await this.insertCommentAtPosition(editor, comment);
            vscode.window.showInformationMessage('✅ KI-verbesserter Kommentar eingefügt!');
            ErrorHandler.log('VoiceHandler', `KI-Kommentar: "${comment}"`, 'success');
        } catch (error) {
            ErrorHandler.handleWarning('VoiceHandler', 'KI-Verbesserung fehlgeschlagen, verwende Original');
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
     * Lädt STT Provider neu (nach Config-Änderung)
     */
    public async reloadSTTProvider(): Promise<void> {
        ErrorHandler.log('VoiceHandler', 'Lade STT Provider neu...');
        await this.initializeSTTProvider();
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
        }
        this.recorder.dispose();
    }
}
