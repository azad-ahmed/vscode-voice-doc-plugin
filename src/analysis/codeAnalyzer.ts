import * as vscode from 'vscode';
import axios from 'axios';
import { LearningSystem } from '../learning/learningSystem';

/**
 * Code Analyzer Service - Analyzes code automatically with GPT-4
 */
export class CodeAnalyzer {
    private cache: Map<string, AnalysisResult>;
    private readonly CACHE_SIZE = 100;

    constructor(
        private learningSystem: LearningSystem
    ) {
        this.cache = new Map();
    }

    /**
     * Analyzes code context and generates documentation suggestion
     */
    async analyzeCode(codeContext: CodeContext): Promise<AnalysisResult> {
        const cacheKey = this.generateCacheKey(codeContext);
        if (this.cache.has(cacheKey)) {
            console.log(`Cache hit for ${codeContext.functionName}`);
            return this.cache.get(cacheKey)!;
        }

        try {
            const apiKey = await this.getApiKey();

            if (!apiKey) {
                throw new Error('OpenAI API Key not configured');
            }

            const similarExamples = this.learningSystem.findSimilarExamples(codeContext);
            const prompt = this.buildImprovedPrompt(codeContext, similarExamples);

            console.log(`Calling GPT-4 for ${codeContext.functionType}: ${codeContext.functionName}`);

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: this.getImprovedSystemPrompt()
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 150  // REDUZIERT von 300
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const analysis = this.parseImprovedResponse(response.data, codeContext);
            
            console.log(`GPT Response: "${analysis.description.substring(0, 100)}..."`);
            
            this.cache.set(cacheKey, analysis);
            
            if (this.cache.size > this.CACHE_SIZE) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey !== undefined) {
                    this.cache.delete(firstKey);
                }
            }

            return analysis;

        } catch (error) {
            console.error('Code analysis error:', error);
            throw new Error(`Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Improved system prompt with VERY CLEAR instructions
     */
    private getImprovedSystemPrompt(): string {
        return `You are a code documentation expert. Your task is to write SHORT, DIRECT documentation.

CRITICAL RULES:
1. Write ONLY the documentation text - NO meta-text!
2. Start directly with the description
3. Maximum 1-2 sentences
4. Use German language
5. Describe WHAT the code does, not HOW

FORBIDDEN phrases (NEVER use these):
❌ "Erstellt einen"
❌ "Erstelle einen"
❌ "JSDoc-Kommentar"
❌ "Der Kommentar soll"
❌ "Dokumentiere"
❌ "beschreibt"

GOOD examples:
✅ "Verwaltet Benutzer-Authentifizierung und Session-Daten"
✅ "Berechnet die Gesamtsumme aller Warenkorb-Artikel"
✅ "Erstellt eine Datenbankverbindung mit den angegebenen Parametern"

BAD examples:
❌ "Erstellt einen JSDoc-Kommentar für die Methode..."
❌ "Der Kommentar beschreibt die Funktion..."

REMEMBER: Output ONLY the description, nothing else!`;
    }

    /**
     * Builds improved prompt with VERY DIRECT instructions
     */
    private buildImprovedPrompt(codeContext: CodeContext, similarExamples: any[]): string {
        // SIMPLIFIED PROMPT
        return `Analyze this ${codeContext.functionType}: "${codeContext.functionName}"

Code:
\`\`\`${codeContext.languageId}
${codeContext.code.substring(0, 500)}
\`\`\`

Write a SHORT documentation (1-2 sentences, German, direct description).
Output ONLY the text, NO meta-text!`;
    }

    /**
     * IMPROVED response parsing with STRICT meta-text detection
     */
    private parseImprovedResponse(responseData: any, codeContext: CodeContext): AnalysisResult {
        try {
            let content = responseData.choices[0].message.content.trim();
            
            // ERWEITERTE Meta-Phrase Detection
            const forbiddenPatterns = [
                /erstellt?\s+einen?\s+(jsdoc|kommentar)/i,
                /erstelle\s+einen?\s+(professionellen|jsdoc)/i,
                /der\s+kommentar\s+soll/i,
                /dokumentiere?\s+(die|den|das)/i,
                /beschreibt?,?\s+was\s+(der\s+code|die\s+methode)/i,
                /der\s+code\s+führt\s+aus/i,
                /diese\s+(methode|funktion|klasse)\s+wird/i,
                /kommentar\s+für\s+(dieses?|die|den)/i,
                /soll\s+beschreiben/i
            ];

            // Prüfe ALLE Patterns
            for (const pattern of forbiddenPatterns) {
                if (pattern.test(content)) {
                    console.warn(`❌ Meta-text detected (pattern: ${pattern})`);
                    console.warn(`   Content: "${content.substring(0, 100)}..."`);
                    return this.createFallbackComment(codeContext);
                }
            }

            // Entferne JSON wenn vorhanden
            const jsonMatch = content.match(/\{[\s\S]*"description":\s*"([^"]+)"[\s\S]*\}/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }

            // Cleanup
            content = content
                .replace(/^["']|["']$/g, '')
                .replace(/^\*+\s*/g, '')  // Remove leading asterisks
                .trim();

            // Validierung
            if (content.length < 10) {
                console.warn(`⚠️ Content too short (${content.length} chars)`);
                return this.createFallbackComment(codeContext);
            }

            if (content.length > 500) {
                console.warn(`⚠️ Content too long (${content.length} chars), truncating`);
                content = content.substring(0, 500) + '...';
            }

            console.log(`✅ Valid comment generated: "${content.substring(0, 80)}..."`);

            return {
                description: content,
                details: '',
                confidence: 0.85
            };

        } catch (error) {
            console.error('Failed to parse response:', error);
            return this.createFallbackComment(codeContext);
        }
    }

    /**
     * Creates BETTER fallback comments
     */
    private createFallbackComment(codeContext: CodeContext): AnalysisResult {
        let description = '';
        
        const name = codeContext.functionName;
        
        switch (codeContext.functionType) {
            case 'class':
                description = `Implementiert die ${name}-Klasse mit zugehörigen Methoden und Properties`;
                break;
            case 'function':
                description = `Führt die ${name}-Operation aus und gibt das Ergebnis zurück`;
                break;
            case 'method':
                // Versuche aus Name zu erraten
                if (name.toLowerCase().includes('get')) {
                    description = `Liefert Daten zurück`;
                } else if (name.toLowerCase().includes('set') || name.toLowerCase().includes('update')) {
                    description = `Aktualisiert Daten`;
                } else if (name.toLowerCase().includes('delete') || name.toLowerCase().includes('remove')) {
                    description = `Entfernt Daten`;
                } else if (name.toLowerCase().includes('create') || name.toLowerCase().includes('add')) {
                    description = `Erstellt neue Daten`;
                } else if (name.toLowerCase().includes('calculate') || name.toLowerCase().includes('compute')) {
                    description = `Berechnet Werte`;
                } else {
                    description = `Verarbeitet ${name}-Operation`;
                }
                break;
            default:
                description = `Implementiert ${name}`;
        }

        console.log(`📝 Using fallback comment: "${description}"`);

        return {
            description,
            details: 'Generated by fallback (Meta-text detected or API error)',
            confidence: 0.3
        };
    }

    /**
     * Extracts pure text from comment (without comment syntax)
     */
    private extractCommentText(comment: string): string {
        return comment
            .replace(/\/\*\*|\*\/|\/\*|\*|\/\/|"""|'''/g, '')
            .replace(/^\s+|\s+$/g, '')
            .replace(/\n\s*/g, ' ')
            .substring(0, 150);
    }

    /**
     * Generates cache key for code context
     */
    private generateCacheKey(codeContext: CodeContext): string {
        const codeHash = this.simpleHash(codeContext.code);
        return `${codeContext.languageId}-${codeContext.functionName}-${codeHash}`;
    }

    /**
     * Simple hash for strings
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Gets OpenAI API Key from SecretStorage
     */
    private async getApiKey(): Promise<string | undefined> {
        if (process.env.OPENAI_API_KEY) {
            return process.env.OPENAI_API_KEY;
        }
        
        try {
            const { ConfigManager } = await import('../utils/configManager');
            return await ConfigManager.getSecret('openAIApiKey');
        } catch {
            return undefined;
        }
    }

    /**
     * Clears cache
     */
    clearCache(): void {
        this.cache.clear();
        console.log('Cache cleared');
    }
}

/**
 * Interfaces & Types
 */
export interface CodeContext {
    code: string;
    line: number;
    languageId: string;
    functionName: string;
    functionType: 'function' | 'class' | 'method' | 'code';
}

export interface AnalysisResult {
    description: string;
    details: string;
    confidence: number;
}

export interface CodeElement {
    type: 'function' | 'class' | 'method';
    name: string;
    line: number;
    hasComment: boolean;
    complexity?: number;
}
