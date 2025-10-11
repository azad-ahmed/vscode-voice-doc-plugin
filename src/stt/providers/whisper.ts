import { STTProvider } from '../types';
import * as https from 'https';
import { FileSystemHelper } from '../../utils/fileSystemHelper';
import { ErrorHandler } from '../../utils/errorHandler';
import FormData = require('form-data');

/**
 * OpenAI Whisper API Provider für Speech-to-Text
 * Beste Qualität und Sprachunterstützung
 */
export class OpenAIWhisperProvider implements STTProvider {
    readonly name = 'OpenAI Whisper API';
    private apiKey: string | null = null;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || null;
    }

    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey !== null && this.apiKey.trim().length > 0;
    }

    async transcribe(audioPath: string, language?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenAI API Key nicht konfiguriert');
        }

        if (!FileSystemHelper.fileExists(audioPath)) {
            throw new Error(`Audio-Datei nicht gefunden: ${audioPath}`);
        }

        try {
            const text = await this.callWhisperAPI(audioPath, language);
            return text.trim();
        } catch (error: any) {
            throw new Error(`Whisper Transkription fehlgeschlagen: ${error.message}`);
        }
    }

    private async callWhisperAPI(audioPath: string, language?: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const fs = require('fs');
            const form = new FormData();
            form.append('file', fs.createReadStream(audioPath));
            form.append('model', 'whisper-1');
            
            if (language) {
                const langCode = language.split('-')[0].toLowerCase();
                form.append('language', langCode);
            }

            const options = {
                hostname: 'api.openai.com',
                path: '/v1/audio/transcriptions',
                method: 'POST',
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${this.apiKey}`
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(data);
                            resolve(response.text);
                        } else {
                            const error = JSON.parse(data);
                            reject(new Error(error.error?.message || `HTTP ${res.statusCode}`));
                        }
                    } catch (error) {
                        reject(new Error(`Parse Error: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            form.pipe(req);
        });
    }

    async testConnection(): Promise<boolean> {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await this.makeRequest('/v1/models', 'GET');
            return response.status === 200;
        } catch {
            return false;
        }
    }

    private makeRequest(path: string, method: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.openai.com',
                path: path,
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.end();
        });
    }
}
