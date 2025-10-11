import * as vscode from 'vscode';
import * as https from 'https';
import { CodeBlock } from './codeParser';
import { ConfigManager } from './configManager';
import { ErrorHandler } from './errorHandler';

/**
 * Analysiert Code mit KI und generiert intelligente Dokumentation
 */
export class AICodeAnalyzer {
    private requestTimeout: number = 60000;

    /**
     * Analysiert einen Code-Block und generiert Dokumentation
     */
    async analyzeAndDocument(
        block: CodeBlock,
        context: string,
        languageId: string
    ): Promise<string> {
        const apiKey = await ConfigManager.getSecret('openAIApiKey');
        
        if (!apiKey) {
            return this.generateBasicDocumentation(block);
        }

        try {
            const analysis = await this.analyzeWithOpenAI(block, context, languageId);
            return analysis;
        } catch (error) {
            ErrorHandler.log('AICodeAnalyzer', 'KI-Analyse fehlgeschlagen, nutze Fallback');
            return this.generateBasicDocumentation(block);
        }
    }

    /**
     * Analysiert Code mit OpenAI GPT
     */
    private async analyzeWithOpenAI(
        block: CodeBlock,
        context: string,
        languageId: string
    ): Promise<string> {
        const apiKey = await ConfigManager.getSecret('openAIApiKey');
        
        if (!apiKey) {
            throw new Error('OpenAI API Key nicht konfiguriert');
        }

        const prompt = this.buildAnalysisPrompt(block, context, languageId);

        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'Du bist ein Experte für Code-Dokumentation. Analysiere den gegebenen Code und erstelle eine präzise, professionelle Dokumentation. ' +
                                'Erkläre WAS der Code macht, WARUM bestimmte Entscheidungen getroffen wurden, und WANN der Code verwendet werden sollte. ' +
                                'Sei präzise aber verständlich. Verwende keine Code-Blöcke in deiner Antwort, nur Text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 300
            });

            const options = {
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(requestBody)
                },
                timeout: this.requestTimeout
            };

            let timeoutHandle: NodeJS.Timeout;
            let hasTimedOut = false;

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }

                    if (hasTimedOut) {
                        return;
                    }

                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(data);
                            const analysis = response.choices?.[0]?.message?.content;
                            resolve(analysis ? analysis.trim() : this.generateBasicDocumentation(block));
                        } else {
                            ErrorHandler.log('AICodeAnalyzer', `OpenAI API Error: ${res.statusCode}`);
                            resolve(this.generateBasicDocumentation(block));
                        }
                    } catch (error) {
                        ErrorHandler.handleError('AICodeAnalyzer', error, false);
                        resolve(this.generateBasicDocumentation(block));
                    }
                });
            });

            req.on('error', (error) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                
                if (!hasTimedOut) {
                    ErrorHandler.handleError('AICodeAnalyzer', error, false);
                    resolve(this.generateBasicDocumentation(block));
                }
            });

            timeoutHandle = setTimeout(() => {
                hasTimedOut = true;
                req.destroy();
                ErrorHandler.log('AICodeAnalyzer', 'Request Timeout');
                resolve(this.generateBasicDocumentation(block));
            }, this.requestTimeout);

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Erstellt den Analyse-Prompt für OpenAI
     */
    private buildAnalysisPrompt(block: CodeBlock, context: string, languageId: string): string {
        const typeDescriptions = {
            'function': 'Funktion',
            'method': 'Methode',
            'class': 'Klasse',
            'interface': 'Interface',
            'const': 'Konstante',
            'variable': 'Variable'
        };

        let prompt = `Analysiere diese ${typeDescriptions[block.type]} in ${languageId}:\n\n`;
        prompt += `Name: ${block.name}\n`;
        prompt += `Code:\n${block.code}\n\n`;
        
        if (context && context.trim().length > 0) {
            prompt += `Kontext (umgebender Code):\n${context}\n\n`;
        }

        if (block.parameters && block.parameters.length > 0) {
            prompt += `Parameter: ${block.parameters.join(', ')}\n`;
        }

        if (block.returnType) {
            prompt += `Rückgabetyp: ${block.returnType}\n`;
        }

        prompt += `\nErstelle eine präzise Dokumentation die erklärt:\n`;
        prompt += `1. Was macht diese ${typeDescriptions[block.type]}?\n`;
        prompt += `2. Welche Parameter gibt es und was bedeuten sie?\n`;
        prompt += `3. Was ist der Rückgabewert?\n`;
        prompt += `4. Gibt es Besonderheiten oder wichtige Details?\n\n`;
        prompt += `Antworte nur mit dem Dokumentationstext, ohne Code-Blöcke.`;

        return prompt;
    }

    /**
     * Generiert eine einfache Dokumentation ohne KI
     */
    private generateBasicDocumentation(block: CodeBlock): string {
        const typeDescriptions = {
            'function': 'Funktion',
            'method': 'Methode',
            'class': 'Klasse',
            'interface': 'Interface',
            'const': 'Konstante',
            'variable': 'Variable'
        };

        let doc = `${typeDescriptions[block.type]} ${block.name}`;

        if (block.parameters && block.parameters.length > 0) {
            doc += `\n\nParameter:\n`;
            block.parameters.forEach(param => {
                doc += `• ${param}\n`;
            });
        }

        if (block.returnType) {
            doc += `\nRückgabetyp: ${block.returnType}`;
        }

        return doc.trim();
    }

    /**
     * Batch-Analyse mehrerer Code-Blöcke
     */
    async analyzeBatch(
        blocks: CodeBlock[],
        document: vscode.TextDocument,
        maxBlocks: number = 5
    ): Promise<Map<CodeBlock, string>> {
        const results = new Map<CodeBlock, string>();
        const blocksToAnalyze = blocks.slice(0, maxBlocks);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analysiere ${blocksToAnalyze.length} Code-Blöcke...`,
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < blocksToAnalyze.length; i++) {
                const block = blocksToAnalyze[i];
                
                progress.report({
                    message: `${i + 1}/${blocksToAnalyze.length}: ${block.name}`,
                    increment: (100 / blocksToAnalyze.length)
                });

                const context = this.getBlockContext(document, block);
                const documentation = await this.analyzeAndDocument(
                    block,
                    context,
                    document.languageId
                );

                results.set(block, documentation);

                await new Promise(resolve => setTimeout(resolve, 500));
            }
        });

        return results;
    }

    /**
     * Holt den Kontext um einen Code-Block
     */
    private getBlockContext(document: vscode.TextDocument, block: CodeBlock): string {
        const startLine = Math.max(0, block.range.start.line - 3);
        const endLine = Math.min(document.lineCount - 1, block.range.end.line + 10);

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
        }

        return lines.join('\n');
    }
}
