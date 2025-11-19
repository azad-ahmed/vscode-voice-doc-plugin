import * as vscode from 'vscode';
import { CommentGenerator } from './generator';
import { AudioRecorder } from './audio/recorder';
import { STTFactory } from './stt/factory';
import { STTProvider } from './stt/types';
import { ErrorHandler } from './utils/errorHandler';
import { ConfigManager } from './utils/configManager';
import { ApiUsageTracker } from './utils/apiUsageTracker';
import { AudioQualityValidator } from './utils/audioQualityValidator';
// ✨ NEU: AST-basierte intelligente Platzierung
import { IntelligentCommentPlacer } from './placement/intelligentPlacer';
// ✨ NEU: Hybrid Intelligence Manager für intelligente Platzierung
import { HybridIntelligenceManager } from './offline-intelligence/hybridManager';

/**
 * Verwaltet Audio-Aufnahme und Transkriptions-Workflow
 * ✨ Jetzt mit AST-basierter intelligenter Kommentar-Platzierung
 */
export class IntegratedVoiceHandler {
    private generator: CommentGenerator;
    private recorder: AudioRecorder;
    private sttProvider: STTProvider | null = null;
    private _isRecording: boolean = false;
    private context: vscode.ExtensionContext;
    private maxRecordingTimeMs: number = 30000;
    private recordingTimer: NodeJS.Timeout | null = null;
    // ✨ NEU: Intelligenter Placer für AST-Analyse
    private intelligentPlacer: IntelligentCommentPlacer;

    constructor(context: vscode.ExtensionContext, generator: CommentGenerator) {
        this.context = context;
        this.generator = generator;
        this.recorder = new AudioRecorder();
        // ✨ NEU: Initialisiere intelligenten Placer
        this.intelligentPlacer = new IntelligentCommentPlacer();
        
        this.initializeSTTProvider();
    }

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

    public isRecording(): boolean {
        return this._isRecording;
    }

    public async toggleRecording(): Promise<void> {
        if (this._isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

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

            await this.recorder.start();
            this._isRecording = true;

            this.recordingTimer = setTimeout(() => {
                if (this._isRecording) {
                    ErrorHandler.log('VoiceHandler', 'Automatischer Stopp nach maximaler Aufnahmedauer');
                    this.stopRecording();
                }
            }, this.maxRecordingTimeMs);

            vscode.window.showInformationMessage('🎤 Aufnahme läuft... (Max 30 Sek.)');
            ErrorHandler.log('VoiceHandler', 'Aufnahme gestartet', 'success');

        } catch (error: any) {
            this._isRecording = false;
            ErrorHandler.handleError('startRecording', error);
        }
    }

    public async stopRecording(): Promise<void> {
        if (!this._isRecording) {
            return;
        }

        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
            this.recordingTimer = null;
        }

        let audioPath: string | null = null;

        try {
            audioPath = await this.recorder.stop();
            
            vscode.window.showInformationMessage('⏹️ Aufnahme gestoppt. Transkribiere...');
            ErrorHandler.log('VoiceHandler', `Aufnahme gespeichert: ${audioPath}`, 'success');

            await this.transcribeAndProcess(audioPath);

        } catch (error: any) {
            ErrorHandler.handleError('stopRecording', error);
        } finally {
            this._isRecording = false;
        }
    }

    private async transcribeAndProcess(audioPath: string): Promise<void> {
        if (!this.sttProvider) {
            throw new Error('Kein STT-Provider verfügbar');
        }

        try {
            const validation = await AudioQualityValidator.validateAudioFile(audioPath);
            
            if (!validation.isValid) {
                const proceed = await vscode.window.showWarningMessage(
                    `Audio-Validierung:\n${validation.errors.join('\n')}\n\nTrotzdem fortfahren?`,
                    'Ja',
                    'Nein'
                );
                
                if (proceed !== 'Ja') {
                    return;
                }
            }

            if (validation.warnings.length > 0) {
                ErrorHandler.log('VoiceHandler', `Audio-Warnungen: ${validation.warnings.join(', ')}`);
            }

            const text = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Transkribiere Aufnahme...',
                cancellable: false
            }, async (progress) => {
                try {
                    const language = ConfigManager.get<string>('language', 'de-DE');
                    
                    const startTime = Date.now();
                    
                    const transcribedText = await ErrorHandler.retry(
                        () => this.sttProvider!.transcribe(audioPath, language),
                        {
                            maxRetries: 2,
                            initialDelay: 1000,
                            context: 'STT Transcription'
                        }
                    );
                    
                    const duration = Date.now() - startTime;
                    const durationSeconds = validation.duration ? validation.duration / 1000 : 0;

                    ErrorHandler.log('VoiceHandler', `Transkription erfolgreich in ${duration}ms`, 'success');
                    ErrorHandler.log('VoiceHandler', `Text: "${transcribedText}"`);

                    const provider = this.sttProvider!.name.includes('OpenAI') ? 'openai' : 'azure';
                    await ApiUsageTracker.trackTranscription(provider, durationSeconds, true);

                    return transcribedText;
                } catch (error) {
                    ErrorHandler.handleError('VoiceHandler.transcribe', error, false);
                    throw error; // Re-throw für äußere catch-Block
                }
            });

            await new Promise(resolve => setTimeout(resolve, 100));
            await this.processTranscribedText(text);

        } catch (error: any) {
            ErrorHandler.handleError('transcribeAndProcess', error);
            
            // 🔒 Verhindere Promise Rejection ohne Handling
            return this.handleTranscriptionError(error, audioPath);
        }
    }

    /**
     * 🔒 Behandelt Transkriptionsfehler mit User-Feedback
     */
    private async handleTranscriptionError(error: any, audioPath: string): Promise<void> {
        const retry = await vscode.window.showErrorMessage(
            `Transkription fehlgeschlagen: ${error.message}`,
            'Erneut versuchen',
            'Text manuell eingeben',
            'Abbrechen'
        );

        try {
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
        } catch (retryError) {
            ErrorHandler.handleError('VoiceHandler.handleTranscriptionError', retryError);
            vscode.window.showErrorMessage('❌ Wiederholung fehlgeschlagen');
        }
    }

    /**
     * ✨ NEU: Nutzt AST-basierte intelligente Platzierung als ERSTEN Versuch
     * Fallback auf Claude AI und dann auf einfache Platzierung
     */
    private async processTranscribedText(text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            vscode.window.showWarningMessage('Keine Sprache erkannt.');
            return;
        }

        ErrorHandler.log('VoiceHandler', `Erkannter Text: "${text}"`);

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
            return;
        }

        // Prüfe ob intelligente Platzierung aktiviert ist
        const useIntelligentPlacement = ConfigManager.get<boolean>('intelligentPlacement', true);

        if (useIntelligentPlacement) {
            // ✨ NEU: Versuche ZUERST AST-basierte intelligente Platzierung
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '🧠 Analysiere Code-Struktur...',
                    cancellable: false
                }, async () => {
                    // 1. Verbessere Text mit KI (falls verfügbar)
                    let enhancedText = text;
                    if (this.generator.isOpenAIAvailable()) {
                        try {
                            const codeContext = this.getCodeContext(editor);
                            enhancedText = await ErrorHandler.retry(
                                () => this.generator.enhanceWithOpenAI(text, codeContext),
                                {
                                    maxRetries: 2,
                                    initialDelay: 1000,
                                    context: 'OpenAI Enhancement'
                                }
                            );
                            ErrorHandler.log('VoiceHandler', `✨ KI-Verbesserung: "${enhancedText}"`, 'success');
                        } catch (error) {
                            ErrorHandler.handleWarning('VoiceHandler', 'KI-Verbesserung fehlgeschlagen, verwende Original');
                        }
                    }

                    // 2. ✨ Nutze AST-basierte INTELLIGENTE Platzierung
                    const success = await this.intelligentPlacer.placeCommentIntelligently(
                        editor,
                        enhancedText,
                        editor.selection.active
                    );

                    if (success) {
                        vscode.window.showInformationMessage(
                            '✅ Kommentar intelligent platziert! (AST-Analyse)'
                        );
                        ErrorHandler.log('VoiceHandler', '🎯 AST-basierte Platzierung erfolgreich', 'success');
                    } else {
                        // Fallback: Versuche Claude AI
                        ErrorHandler.log('VoiceHandler', 'AST-Platzierung abgebrochen, versuche Claude AI...');
                        throw new Error('AST placement declined by user');
                    }
                });
                return; // Erfolg!
            } catch (error) {
                ErrorHandler.log('VoiceHandler', '⚠️ AST-Platzierung fehlgeschlagen, nutze Fallback');
            }
        }

        // Fallback 1: Hybrid Intelligence Manager (Claude AI + AST)
        try {
            const success = await HybridIntelligenceManager.processAndPlace(
                editor,
                text
            );

            if (success) {
                return; // Erfolg mit Hybrid Manager!
            }
        } catch (error) {
            ErrorHandler.log('VoiceHandler', '⚠️ Hybrid Platzierung fehlgeschlagen, nutze finalen Fallback');
        }

        // Fallback 2: Einfache Platzierung
        await this.processWithFallback(text, editor);
    }

    /**
     * Fallback-Methode: Einfache Platzierung ohne AST
     */
    private async processWithFallback(text: string, editor: vscode.TextEditor): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `🎯 Generiere Kommentar: "${text.substring(0, 30)}..."`,
            cancellable: false
        }, async () => {
            try {
                const codeContext = this.getCodeContext(editor);
                let enhancedText = text;

                // Versuche KI-Verbesserung
                if (this.generator.isOpenAIAvailable()) {
                    try {
                        enhancedText = await ErrorHandler.retry(
                            () => this.generator.enhanceWithOpenAI(text, codeContext),
                            {
                                maxRetries: 2,
                                initialDelay: 1000,
                                context: 'OpenAI Enhancement'
                            }
                        );
                        ErrorHandler.log('VoiceHandler', `KI-Verbesserung erfolgreich: "${enhancedText}"`, 'success');
                    } catch (error) {
                        ErrorHandler.handleWarning('VoiceHandler', 'KI-Verbesserung fehlgeschlagen, verwende Original');
                    }
                }

                // Formatiere als Kommentar
                const comment = this.generator.formatComment(enhancedText, editor.document.languageId);
                
                // Einfache Platzierung an Cursor-Position
                await this.insertCommentAtPosition(editor, comment);
                
                vscode.window.showInformationMessage(
                    `✅ Kommentar eingefügt`
                );
                ErrorHandler.log('VoiceHandler', `Kommentar erfolgreich eingefügt: "${comment}"`, 'success');

            } catch (error) {
                ErrorHandler.handleError('processWithFallback', error);
                vscode.window.showErrorMessage(
                    `❌ Fehler beim Generieren: ${error instanceof Error ? error.message : 'Unbekannt'}`
                );
            }
        });
    }

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

    private async insertCommentAtPosition(editor: vscode.TextEditor, comment: string): Promise<void> {
        const position = editor.selection.active;
        
        // Einfache Platzierung: Füge an aktueller Position mit korrekter Einrückung ein
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

    public async reloadSTTProvider(): Promise<void> {
        ErrorHandler.log('VoiceHandler', 'Lade STT Provider neu...');
        await this.initializeSTTProvider();
    }

    public dispose(): void {
        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
        }
        this.recorder.dispose();
    }
}
