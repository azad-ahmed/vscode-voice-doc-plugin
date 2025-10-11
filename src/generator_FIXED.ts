import * as vscode from 'vscode';
import * as https from 'https';
import { ConfigManager } from './utils/configManager';
import { ErrorHandler } from './utils/errorHandler';

/**
 * CommentGenerator Klasse
 * Generiert und formatiert Code-Kommentare aus Spracheingaben
 * VERBESSERTE VERSION mit Timeout und besserer Fehlerbehandlung
 */
export class CommentGenerator {
    private language: string;
    private openAIApiKey?: string;
    private requestTimeout: number = 30000; // 30 Sekunden Timeout

    constructor(language: string = 'auto') {
        this.language = language;
        this.loadConfiguration();
    }

    /**
     * Lädt die Konfiguration aus VS Code Settings
     */
    private async loadConfiguration(): Promise<void> {
        this.openAIApiKey = await ConfigManager.getSecret('openAIApiKey');
    }

    /**
     * Hauptmethode: Formatiert einen transkribierten Text zu einem Code-Kommentar
     */
    public formatComment(transcript: string, languageId: string): string {
        if (!transcript || transcript.trim().length === 0) {
            return '// Keine Spracheingabe erkannt';
        }

        const cleanedText = this.cleanTranscript(transcript);
        const processedText = this.processText(cleanedText);
        return this.generateCommentForLanguage(processedText, languageId);
    }

    /**
     * Generiert kontextbasierte Kommentare mit optionaler KI-Verbesserung
     */
    public async generateContextualComment(transcript: string, codeContext: string): Promise<string> {
        const baseComment = this.formatComment(transcript, 'typescript');
        
        if (this.openAIApiKey) {
            try {
                const enhanced = await this.enhanceWithOpenAI(transcript, codeContext);
                return this.formatComment(enhanced, 'typescript');
            } catch (error) {
                ErrorHandler.handleWarning(
                    'CommentGenerator',
                    'OpenAI-Verbesserung fehlgeschlagen, verwende Basis-Kommentar',
                    false
                );
                return baseComment;
            }
        }
        
        return baseComment;
    }

    /**
     * Verbessert Text mit OpenAI API
     * FIX: Mit Timeout und besserer Fehlerbehandlung
     */
    public async enhanceWithOpenAI(transcript: string, codeContext: string | null): Promise<string> {
        if (!this.openAIApiKey) {
            throw new Error('OpenAI API Key nicht konfiguriert');
        }

        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Du bist ein hilfreicher Assistent, der gesprochene Erklärungen in professionelle Code-Kommentare umwandelt. ' +
                                'Formatiere den Text als klaren, präzisen Kommentar. Behalte technische Begriffe bei.'
                    },
                    {
                        role: 'user',
                        content: codeContext 
                            ? `Kontext:\n${codeContext}\n\nErklärung: "${transcript}"`
                            : `Erklärung: "${transcript}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 150
            });

            const options = {
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Length': Buffer.byteLength(requestBody)
                },
                timeout: this.requestTimeout // FIX: Timeout hinzugefügt
            };

            // FIX: Timeout Handler
            let timeoutHandle: NodeJS.Timeout;
            let hasTimedOut = false;

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    // Clear timeout
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }

                    if (hasTimedOut) {
                        return; // Ignore response if already timed out
                    }

                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(data);
                            const enhancedText = response.choices?.[0]?.message?.content || transcript;
                            resolve(enhancedText.trim());
                        } else {
                            ErrorHandler.log(
                                'CommentGenerator',
                                `OpenAI API Error: ${res.statusCode} - ${data}`
                            );
                            resolve(transcript); // Fallback zum Original
                        }
                    } catch (error) {
                        ErrorHandler.handleError('CommentGenerator', error, false);
                        resolve(transcript);
                    }
                });
            });

            req.on('error', (error) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                
                if (!hasTimedOut) {
                    ErrorHandler.handleError('CommentGenerator', error, false);
                    resolve(transcript); // Fallback zum Original
                }
            });

            // FIX: Expliziter Timeout
            timeoutHandle = setTimeout(() => {
                hasTimedOut = true;
                req.destroy();
                ErrorHandler.handleWarning(
                    'CommentGenerator',
                    `OpenAI Request timeout after ${this.requestTimeout}ms`,
                    false
                );
                resolve(transcript); // Fallback zum Original
            }, this.requestTimeout);

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Bereinigt das Transkript
     */
    private cleanTranscript(transcript: string): string {
        return transcript
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^(äh|ähm|also|ja|okay|ok)\s*/gi, '')
            .replace(/\s+(äh|ähm|also|ja)\s+/gi, ' ')
            .replace(/[.,;:!?]+$/, '')
            .trim();
    }

    /**
     * Verarbeitet und verbessert den Text
     */
    private processText(text: string): string {
        if (!text) return text;
        
        text = this.replaceTechnicalTerms(text);
        text = this.improveSentenceStructure(text);
        
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    /**
     * Ersetzt technische Begriffe
     */
    private replaceTechnicalTerms(text: string): string {
        const replacements: { [key: string]: string } = {
            'funktion': 'Funktion',
            'methode': 'Methode',
            'klasse': 'Klasse',
            'variable': 'Variable',
            'parameter': 'Parameter',
            'return': 'Return',
            'array': 'Array',
            'objekt': 'Objekt',
            'string': 'String',
            'number': 'Number',
            'integer': 'Integer',
            'boolean': 'Boolean',
            'schleife': 'Schleife',
            'bedingung': 'Bedingung',
            'datenbank': 'Datenbank',
            'api': 'API'
        };

        let result = text;
        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`\\b${key}\\b`, 'gi');
            result = result.replace(regex, replacements[key]);
        });

        return result;
    }

    /**
     * Verbessert die Satzstruktur
     */
    private improveSentenceStructure(text: string): string {
        const improvements = [
            { pattern: /^(diese|die|der|das)\s+(.+?)\s+(macht|tut|ist|wird)/i, replacement: '$2 $3' },
            { pattern: /^hier\s+(.+)/i, replacement: '$1' },
            { pattern: /^und\s+(.+)/i, replacement: '$1' }
        ];

        let result = text;
        improvements.forEach(({ pattern, replacement }) => {
            result = result.replace(pattern, replacement);
        });

        return result;
    }

    /**
     * Generiert sprachspezifische Kommentare
     */
    private generateCommentForLanguage(text: string, languageId: string): string {
        const commentStyles = this.getCommentStyle(languageId);
        
        if (text.length <= 80) {
            return `${commentStyles.single} ${text}`;
        }

        if (commentStyles.multi) {
            const lines = this.wrapText(text, 70);
            return commentStyles.multi.start + '\n' + 
                   lines.map(line => ` * ${line}`).join('\n') + '\n' + 
                   commentStyles.multi.end;
        }

        const lines = this.wrapText(text, 70);
        return lines.map(line => `${commentStyles.single} ${line}`).join('\n');
    }

    /**
     * Gibt den Kommentarstil für eine Programmiersprache zurück
     */
    private getCommentStyle(languageId: string): {
        single: string;
        multi?: { start: string; end: string };
    } {
        const styles: { [key: string]: any } = {
            'javascript': { single: '//', multi: { start: '/**', end: ' */' } },
            'typescript': { single: '//', multi: { start: '/**', end: ' */' } },
            'typescriptreact': { single: '//', multi: { start: '/**', end: ' */' } },
            'javascriptreact': { single: '//', multi: { start: '/**', end: ' */' } },
            'java': { single: '//', multi: { start: '/**', end: ' */' } },
            'csharp': { single: '//', multi: { start: '/**', end: ' */' } },
            'cpp': { single: '//', multi: { start: '/**', end: ' */' } },
            'c': { single: '//', multi: { start: '/*', end: ' */' } },
            'python': { single: '#', multi: { start: '"""', end: '"""' } },
            'ruby': { single: '#' },
            'php': { single: '//', multi: { start: '/**', end: ' */' } },
            'go': { single: '//', multi: { start: '/*', end: ' */' } },
            'rust': { single: '//', multi: { start: '/*', end: ' */' } },
            'html': { single: '<!--', multi: { start: '<!--', end: '-->' } },
            'css': { single: '//', multi: { start: '/*', end: ' */' } },
            'sql': { single: '--' },
            'bash': { single: '#' },
            'powershell': { single: '#' },
            'yaml': { single: '#' }
        };

        return styles[languageId.toLowerCase()] || { single: '//' };
    }

    /**
     * Bricht Text in Zeilen um
     */
    private wrapText(text: string, maxLength: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            if ((currentLine + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }

        if (currentLine) lines.push(currentLine);
        return lines;
    }

    /**
     * Validiert einen Kommentar
     * FIX: Korrigierte Schwellenwerte basierend auf Dokumentation (60%)
     */
    public validateComment(comment: string): {
        isValid: boolean;
        score: number;
        suggestions: string[];
    } {
        const suggestions: string[] = [];
        let score = 100;

        if (comment.length < 10) {
            score -= 30;
            suggestions.push('Kommentar ist zu kurz');
        }

        if (comment.length > 500) {
            score -= 20;
            suggestions.push('Kommentar ist sehr lang');
        }

        const fillerWords = ['äh', 'ähm', 'also'];
        if (fillerWords.some(word => comment.toLowerCase().includes(word))) {
            score -= 15;
            suggestions.push('Füllwörter entdeckt');
        }

        return {
            isValid: score >= 60, // FIX: 60% threshold aus Dokumentation
            score,
            suggestions
        };
    }

    /**
     * Setzt den OpenAI API Key
     */
    public async setOpenAIApiKey(apiKey: string): Promise<void> {
        await ConfigManager.setSecret('openAIApiKey', apiKey);
        this.openAIApiKey = apiKey;
    }

    /**
     * Prüft ob OpenAI verfügbar ist
     */
    public isOpenAIAvailable(): boolean {
        return !!this.openAIApiKey;
    }

    /**
     * Setzt den Timeout für Requests
     */
    public setRequestTimeout(timeoutMs: number): void {
        this.requestTimeout = timeoutMs;
    }
}
