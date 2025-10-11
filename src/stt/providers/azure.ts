import { STTProvider } from '../types';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { FileSystemHelper } from '../../utils/fileSystemHelper';

/**
 * Azure Cognitive Services Speech-to-Text Provider
 */
export class AzureSTTProvider implements STTProvider {
    readonly name = 'Azure Cognitive Services';
    private apiKey: string | null = null;
    private region: string | null = null;

    constructor(apiKey?: string, region?: string) {
        this.apiKey = apiKey || null;
        this.region = region || null;
    }

    setCredentials(apiKey: string, region: string): void {
        this.apiKey = apiKey;
        this.region = region;
    }

    async isAvailable(): Promise<boolean> {
        return !!(this.apiKey && this.region);
    }

    async transcribe(audioPath: string, language?: string): Promise<string> {
        if (!this.apiKey || !this.region) {
            throw new Error('Azure API Key oder Region nicht konfiguriert');
        }

        if (!FileSystemHelper.fileExists(audioPath)) {
            throw new Error(`Audio-Datei nicht gefunden: ${audioPath}`);
        }

        try {
            const text = await this.recognizeFromFile(audioPath, language);
            return text.trim();
        } catch (error: any) {
            throw new Error(`Azure Transkription fehlgeschlagen: ${error.message}`);
        }
    }

    private async recognizeFromFile(audioPath: string, language?: string): Promise<string> {
        const fs = require('fs');
        
        const speechConfig = sdk.SpeechConfig.fromSubscription(
            this.apiKey!,
            this.region!
        );

        speechConfig.speechRecognitionLanguage = language || 'de-DE';

        const audioConfig = sdk.AudioConfig.fromWavFileInput(
            fs.readFileSync(audioPath)
        );

        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        return new Promise((resolve, reject) => {
            recognizer.recognizeOnceAsync(
                (result: sdk.SpeechRecognitionResult) => {
                    recognizer.close();

                    switch (result.reason) {
                        case sdk.ResultReason.RecognizedSpeech:
                            resolve(result.text);
                            break;

                        case sdk.ResultReason.NoMatch:
                            reject(new Error('Keine Sprache erkannt'));
                            break;

                        case sdk.ResultReason.Canceled:
                            const cancellation = sdk.CancellationDetails.fromResult(result);
                            reject(new Error(`Abgebrochen: ${cancellation.errorDetails}`));
                            break;

                        default:
                            reject(new Error(`Unbekannter Fehler: ${result.reason}`));
                    }
                },
                (error: string) => {
                    recognizer.close();
                    reject(error);
                }
            );
        });
    }

    async testConnection(): Promise<boolean> {
        if (!this.apiKey || !this.region) {
            return false;
        }

        try {
            const speechConfig = sdk.SpeechConfig.fromSubscription(
                this.apiKey,
                this.region
            );
            return true;
        } catch {
            return false;
        }
    }
}
