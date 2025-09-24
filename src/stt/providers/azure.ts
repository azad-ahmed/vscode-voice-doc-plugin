import { STTProvider } from '../factory';
import axios from 'axios';
import * as fs from 'fs';

export class AzureProvider implements STTProvider {
    private apiKey: string;
    private region: string;
    private language: string;

    constructor(apiKey: string, region: string = 'westeurope', language: string = 'de-DE') {
        this.apiKey = apiKey;
        this.region = region;
        this.language = language;
    }

    async transcribe(audioFilePath: string): Promise<string> {
        if (!this.apiKey || this.apiKey === 'dummy') {
            return "Azure STT: Kein gültiger API Key konfiguriert. Bitte in den Einstellungen hinterlegen.";
        }

        try {
            const audioData = fs.readFileSync(audioFilePath);
            
            const response = await axios.post(
                `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
                audioData,
                {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                        'Content-Type': 'audio/wav',
                        'Accept': 'application/json'
                    },
                    params: {
                        language: this.language,
                        format: 'simple'
                    }
                }
            );

            if (response.data && response.data.DisplayText) {
                return response.data.DisplayText;
            } else {
                return "Keine Sprache in der Audiodatei erkannt.";
            }

        } catch (error: any) {
            console.error('Azure STT Error:', error);
            
            if (error.response?.status === 401) {
                return "Azure STT: Ungültiger API Key oder falsche Region.";
            } else if (error.response?.status === 429) {
                return "Azure STT: Rate limit erreicht. Versuchen Sie es später erneut.";
            } else {
                return `Azure STT Fehler: ${error.message}`;
            }
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey || this.apiKey === 'dummy') {
            return false;
        }

        try {
            // Test API connection with a minimal request
            await axios.get(
                `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
                {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey
                    },
                    timeout: 5000
                }
            );
            return true;
        } catch {
            return false;
        }
    }

    getName(): string {
        return 'Azure Cognitive Services';
    }
}