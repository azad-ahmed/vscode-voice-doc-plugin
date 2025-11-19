import * as vscode from 'vscode';
import * as https from 'https';
import { ConfigManager } from './utils/configManager';
import { ErrorHandler } from './utils/errorHandler';
import { DemoGPTEnhancer } from './utils/demoGPTEnhancer';
import { RateLimiter } from './utils/rateLimiter';

/**
 * 🔒 Configuration Constants
 */
const API_CONFIG = {
    OPENAI: {
        MAX_TOKENS: {
            COMMENT: 100,
            ANALYSIS: 500,
            DOCUMENTATION: 1000
        },
        TEMPERATURE: 0.3,
        MODEL: 'gpt-3.5-turbo'
    },
    RATE_LIMIT: {
        MAX_CALLS_PER_MINUTE: 20,
        WINDOW_MS: 60000
    },
    TIMEOUT: {
        REQUEST_MS: 30000,
        CLEANUP_MS: 2000
    },
    VALIDATION: {
        MIN_TEXT_LENGTH: 1,
        MAX_TEXT_LENGTH: 10000,
        MAX_COMMENT_LENGTH: 1000
    }
} as const;

export class CommentGenerator {
    private language: string;
    private openAIApiKey?: string;
    private requestTimeout: number = API_CONFIG.TIMEOUT.REQUEST_MS;
    
    // 🔒 Rate Limiter
    private rateLimiter: RateLimiter;

    constructor(language: string = 'auto') {
        this.language = language;
        this.rateLimiter = new RateLimiter(
            API_CONFIG.RATE_LIMIT.MAX_CALLS_PER_MINUTE,
            API_CONFIG.RATE_LIMIT.WINDOW_MS
        );
        this.loadConfiguration();
    }

    private async loadConfiguration(): Promise<void> {
        this.openAIApiKey = await ConfigManager.getSecret('openAIApiKey');
    }

    public formatComment(transcript: string, languageId: string): string {
        if (!transcript || transcript.trim().length === 0) {
            return '// Keine Spracheingabe erkannt';
        }

        const cleanedText = this.cleanTranscript(transcript);
        const processedText = this.processText(cleanedText);
        return this.generateCommentForLanguage(processedText, languageId);
    }

    public async generateContextualComment(transcript: string, codeContext: string): Promise<string> {
        const baseComment = this.formatComment(transcript, 'typescript');
        
        if (this.openAIApiKey) {
            try {
                const enhanced = await this.enhanceWithOpenAI(transcript, codeContext);
                return this.formatComment(enhanced, 'typescript');
            } catch (error) {
                ErrorHandler.handleWarning(
                    'CommentGenerator',
                    'OpenAI-Verbesserung nicht verfügbar, verwende Standard-Formatierung',
                    false
                );
                return baseComment;
            }
        }
        
        return baseComment;
    }

    public async enhanceWithOpenAI(transcript: string, codeContext: string | null): Promise<string> {
        // 🔒 Verwende Demo-GPT-Enhancer wenn kein API-Key vorhanden
        if (!this.openAIApiKey) {
            ErrorHandler.log('CommentGenerator', 'Nutze Demo-GPT-Verbesserung');
            return DemoGPTEnhancer.enhanceComment(transcript, codeContext || '');
        }
        
        // 🔒 KRITISCH: Rate Limit Check
        try {
            await this.rateLimiter.checkLimit();
        } catch (error: any) {
            ErrorHandler.handleWarning('CommentGenerator', error.message, true);
            // Fallback zu Demo-Enhancer
            return DemoGPTEnhancer.enhanceComment(transcript, codeContext || '');
        }
        
        // 🔒 Input Sanitization
        const sanitizedTranscript = this.sanitizeInput(transcript);
        const sanitizedContext = codeContext ? this.sanitizeInput(codeContext) : null;
        
        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: API_CONFIG.OPENAI.MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'Du bist ein Assistent für Code-Dokumentation. ' +
                                'Deine Aufgabe: Wandle gesprochene Erklärungen in KURZE, KLARE Kommentare um. ' +
                                'WICHTIG: ' +
                                '- NUR Text ausgeben, KEINE Code-Blöcke ' +
                                '- KEINE ```javascript Blöcke ' +
                                '- KEINE Markdown-Formatierung ' +
                                '- Maximal 1-2 Sätze ' +
                                '- Deutsch verwenden ' +
                                '- Technische Begriffe beibehalten'
                    },
                    {
                        role: 'user',
                        content: sanitizedContext 
                            ? `Kontext:\n${sanitizedContext}\n\nErklärung: "${sanitizedTranscript}"\n\nAufgabe: Erstelle einen KURZEN Kommentar (1-2 Sätze, NUR Text, KEINE Code-Blöcke).`
                            : `Erklärung: "${sanitizedTranscript}"\n\nAufgabe: Erstelle einen KURZEN Kommentar (1-2 Sätze, NUR Text, KEINE Code-Blöcke).`
                    }
                ],
                temperature: API_CONFIG.OPENAI.TEMPERATURE,
                max_tokens: API_CONFIG.OPENAI.MAX_TOKENS.COMMENT
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
                timeout: this.requestTimeout
            };

            // 🔒 Besseres Timeout-Handling
            let timeoutHandle: NodeJS.Timeout;
            let hasTimedOut = false;
            let isResolved = false;

            const cleanup = () => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
            };

            const safeResolve = (value: string) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    resolve(value);
                }
            };

            const safeReject = (error: Error) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(error);
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (hasTimedOut || isResolved) {
                        return;
                    }

                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(data);
                            let enhancedText = response.choices?.[0]?.message?.content || sanitizedTranscript;
                            
                            // 🔒 Bereinige OpenAI Antwort
                            enhancedText = this.cleanOpenAIResponse(enhancedText);
                            
                            safeResolve(enhancedText.trim());
                        } else if (res.statusCode === 429) {
                            // Rate Limit von OpenAI
                            ErrorHandler.log(
                                'CommentGenerator',
                                'OpenAI Rate Limit erreicht, nutze Fallback'
                            );
                            safeResolve(DemoGPTEnhancer.enhanceComment(sanitizedTranscript, sanitizedContext || ''));
                        } else {
                            ErrorHandler.log(
                                'CommentGenerator',
                                `OpenAI API Fehler: ${res.statusCode}`
                            );
                            safeResolve(sanitizedTranscript);
                        }
                    } catch (error) {
                        ErrorHandler.handleError('CommentGenerator.parseResponse', error, false);
                        safeResolve(sanitizedTranscript);
                    }
                });
            });

            req.on('error', (error) => {
                if (!hasTimedOut && !isResolved) {
                    ErrorHandler.handleError('CommentGenerator.request', error, false);
                    safeResolve(sanitizedTranscript);
                }
            });

            // 🔒 Timeout mit Cleanup
            timeoutHandle = setTimeout(() => {
                hasTimedOut = true;
                req.destroy();
                ErrorHandler.handleWarning(
                    'CommentGenerator',
                    `OpenAI Request Timeout nach ${this.requestTimeout}ms`,
                    false
                );
                safeResolve(sanitizedTranscript);
            }, this.requestTimeout);

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * 🔒 KRITISCH: Input Sanitization
     * Verhindert XSS, Code Injection und validiert Länge
     */
    private sanitizeInput(text: string): string {
        if (!text) {
            throw new Error('Input darf nicht leer sein');
        }

        // Längen-Validierung
        if (text.length < API_CONFIG.VALIDATION.MIN_TEXT_LENGTH) {
            throw new Error('Input zu kurz');
        }
        
        if (text.length > API_CONFIG.VALIDATION.MAX_TEXT_LENGTH) {
            throw new Error(`Input zu lang (max ${API_CONFIG.VALIDATION.MAX_TEXT_LENGTH} Zeichen)`);
        }

        return text
            .trim()
            // Entferne potentiell gefährliche Zeichen
            .replace(/[<>]/g, '')
            // Normalisiere Whitespace
            .replace(/\s+/g, ' ')
            // Begrenze finale Länge
            .substring(0, API_CONFIG.VALIDATION.MAX_COMMENT_LENGTH);
    }

    /**
     * 🔒 Bereinigt OpenAI Antwort von Code-Blöcken und Markdown
     * ✅ VERBESSERT: Robustere Regex-Patterns, Längen-Limitierung
     */
    private cleanOpenAIResponse(text: string): string {
        // Entferne ALLE Code-Blöcke (javascript, typescript, python, etc.)
        // ✅ NEU: Case-insensitive und alle Sprachen
        text = text.replace(/```[a-z]*\s*([\s\S]*?)```/gi, '$1');
        
        // Entferne Markdown Bold/Italic (non-greedy)
        text = text.replace(/\*\*(.+?)\*\*/g, '$1');
        text = text.replace(/\*(.+?)\*/g, '$1');
        text = text.replace(/__(.+?)__/g, '$1');
        text = text.replace(/_(.+?)_/g, '$1');
        
        // Entferne überflüssige Leerzeilen
        text = text.replace(/\n{3,}/g, '\n\n');
        
        // 🔒 NEU: Entferne führende/trailing Whitespace
        text = text.trim();
        
        // 🔒 NEU: Begrenze auf maximale Länge (verhindert zu lange Kommentare)
        if (text.length > API_CONFIG.VALIDATION.MAX_COMMENT_LENGTH) {
            text = text.substring(0, API_CONFIG.VALIDATION.MAX_COMMENT_LENGTH - 3) + '...';
        }
        
        return text;
    }

    private cleanTranscript(transcript: string): string {
        return transcript
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^(äh|ähm|also|ja|okay|ok)\s*/gi, '')
            .replace(/\s+(äh|ähm|also|ja)\s+/gi, ' ')
            .replace(/[.,;:!?]+$/, '')
            .trim();
    }

    private processText(text: string): string {
        if (!text) return text;
        
        text = this.replaceTechnicalTerms(text);
        text = this.improveSentenceStructure(text);
        
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

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
            'api': 'API',
            'interface': 'Interface',
            'callback': 'Callback',
            'promise': 'Promise',
            'async': 'Async',
            'await': 'Await'
        };

        let result = text;
        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`\\b${key}\\b`, 'gi');
            result = result.replace(regex, replacements[key]);
        });

        return result;
    }

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
            'scss': { single: '//', multi: { start: '/*', end: ' */' } },
            'less': { single: '//', multi: { start: '/*', end: ' */' } },
            'sql': { single: '--' },
            'bash': { single: '#' },
            'shell': { single: '#' },
            'powershell': { single: '#' },
            'yaml': { single: '#' },
            'xml': { single: '<!--', multi: { start: '<!--', end: '-->' } },
            'markdown': { single: '<!--', multi: { start: '<!--', end: '-->' } }
        };

        return styles[languageId.toLowerCase()] || { single: '//' };
    }

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
            isValid: score >= 60,
            score,
            suggestions
        };
    }

    public async setOpenAIApiKey(apiKey: string): Promise<void> {
        await ConfigManager.setSecret('openAIApiKey', apiKey);
        this.openAIApiKey = apiKey;
        // 🔒 SICHERHEIT: Logge NIEMALS den API Key
        ErrorHandler.log('CommentGenerator', 'API Provider konfiguriert', 'success');
    }

    public isOpenAIAvailable(): boolean {
        return !!this.openAIApiKey;
    }

    public setRequestTimeout(timeoutMs: number): void {
        this.requestTimeout = timeoutMs;
    }

    /**
     * 🔒 Gibt Rate Limiter Statistik zurück
     */
    public getRateLimitStats() {
        return this.rateLimiter.getUsageStats();
    }

    /**
     * 🔒 Setzt Rate Limiter zurück
     */
    public resetRateLimit(): void {
        this.rateLimiter.reset();
    }
}
