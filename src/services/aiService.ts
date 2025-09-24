import * as vscode from 'vscode';
import fetch from 'node-fetch';

export interface AIResponse {
    success: boolean;
    text: string;
    error?: string;
}

export interface AIProvider {
    enhanceComment(transcript: string, codeContext?: string, languageId?: string): Promise<AIResponse>;
}

export class AIService {
    private openaiProvider: OpenAIProvider;
    private anthropicProvider: AnthropicProvider;

    constructor() {
        this.openaiProvider = new OpenAIProvider();
        this.anthropicProvider = new AnthropicProvider();
    }

    async enhanceComment(transcript: string, codeContext?: string, languageId?: string): Promise<AIResponse> {
        const config = vscode.workspace.getConfiguration('voiceDoc');
        const provider = config.get<string>('aiProvider', 'local');

        switch (provider) {
            case 'openai':
                return this.openaiProvider.enhanceComment(transcript, codeContext, languageId);
            case 'anthropic':
                return this.anthropicProvider.enhanceComment(transcript, codeContext, languageId);
            default:
                return {
                    success: true,
                    text: transcript
                };
        }
    }

    async testConnection(): Promise<{ openai: boolean; anthropic: boolean }> {
        const config = vscode.workspace.getConfiguration('voiceDoc');
        
        const openaiTest = config.get<string>('openai.apiKey') ? 
            await this.openaiProvider.testConnection() : false;
        const anthropicTest = config.get<string>('anthropic.apiKey') ? 
            await this.anthropicProvider.testConnection() : false;

        return { openai: openaiTest, anthropic: anthropicTest };
    }
}

class OpenAIProvider implements AIProvider {
    async enhanceComment(transcript: string, codeContext?: string, languageId?: string): Promise<AIResponse> {
        try {
            const config = vscode.workspace.getConfiguration('voiceDoc');
            const apiKey = config.get<string>('openai.apiKey');
            const model = config.get<string>('openai.model', 'gpt-3.5-turbo');

            if (!apiKey) {
                return {
                    success: false,
                    text: transcript,
                    error: 'OpenAI API Key nicht konfiguriert. Verwende: Voice Doc: Configure AI APIs'
                };
            }

            const systemPrompt = this.createSystemPrompt(languageId);
            const userPrompt = this.createUserPrompt(transcript, codeContext, languageId);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: 300,
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const enhancedText = data.choices[0]?.message?.content?.trim();

            return {
                success: true,
                text: enhancedText || transcript
            };

        } catch (error: any) {
            console.error('OpenAI API Error:', error);
            return {
                success: false,
                text: transcript,
                error: error?.message || 'Unbekannter OpenAI Fehler'
            };
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('voiceDoc');
            const apiKey = config.get<string>('openai.apiKey');

            if (!apiKey) {
                return false;
            }

            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    private createSystemPrompt(languageId?: string): string {
        return `Du bist ein Experte für Code-Dokumentation. Erstelle professionelle, präzise Code-Kommentare aus gesprochenen Erklärungen.

Regeln:
- Verwende deutsche Sprache
- Sei konkret und technisch präzise
- Entferne Füllwörter ("äh", "also", etc.)
- Verwende Fachterminologie korrekt
- Formatiere als Kommentar für ${languageId || 'code'}
- Halte dich kurz aber informativ`;
    }

    private createUserPrompt(transcript: string, codeContext?: string, languageId?: string): string {
        let prompt = `Erstelle einen Code-Kommentar aus: "${transcript}"`;
        
        if (codeContext) {
            prompt += `\n\nCode-Kontext:\n${codeContext}`;
        }
        
        if (languageId) {
            prompt += `\n\nProgrammiersprache: ${languageId}`;
        }
        
        prompt += '\n\nAntworte nur mit dem fertigen Kommentar, ohne weitere Erklärungen.';
        
        return prompt;
    }
}

class AnthropicProvider implements AIProvider {
    async enhanceComment(transcript: string, codeContext?: string, languageId?: string): Promise<AIResponse> {
        try {
            const config = vscode.workspace.getConfiguration('voiceDoc');
            const apiKey = config.get<string>('anthropic.apiKey');
            const model = config.get<string>('anthropic.model', 'claude-3-haiku-20240307');

            if (!apiKey) {
                return {
                    success: false,
                    text: transcript,
                    error: 'Anthropic API Key nicht konfiguriert. Verwende: Voice Doc: Configure AI APIs'
                };
            }

            const prompt = this.createPrompt(transcript, codeContext, languageId);

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey, // apiKey ist hier garantiert nicht undefined
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 300,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const enhancedText = data.content[0]?.text?.trim();

            return {
                success: true,
                text: enhancedText || transcript
            };

        } catch (error: any) {
            console.error('Anthropic API Error:', error);
            return {
                success: false,
                text: transcript,
                error: error?.message || 'Unbekannter Claude Fehler'
            };
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('voiceDoc');
            const apiKey = config.get<string>('anthropic.apiKey');

            if (!apiKey) {
                return false;
            }

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey, // apiKey ist hier garantiert nicht undefined
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Test' }]
                })
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    private createPrompt(transcript: string, codeContext?: string, languageId?: string): string {
        let prompt = `Du bist ein Experte für Code-Dokumentation. Erstelle einen professionellen, präzisen Code-Kommentar aus dieser gesprochenen Erklärung auf Deutsch:

"${transcript}"`;

        if (codeContext) {
            prompt += `\n\nCode-Kontext:\n${codeContext}`;
        }

        if (languageId) {
            prompt += `\nProgrammiersprache: ${languageId}`;
        }

        prompt += `\n\nRegeln:
- Entferne Füllwörter und Umgangssprache
- Verwende Fachterminologie korrekt
- Sei konkret und informativ
- Formatiere als Code-Kommentar

Antworte nur mit dem fertigen Kommentar.`;

        return prompt;
    }
}