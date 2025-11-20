import * as vscode from 'vscode';
import axios from 'axios';
import { LearningSystem } from '../learning/learningSystem';

/**
 * Code Analyzer Service - Analysiert Code automatisch mit GPT-4
 * ✨ OPTIMIERT: Bessere Prompts für präzise Kommentare
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
     * Analysiert Code-Kontext und generiert Dokumentationsvorschlag
     */
    async analyzeCode(codeContext: CodeContext): Promise<AnalysisResult> {
        // Prüfe Cache
        const cacheKey = this.generateCacheKey(codeContext);
        if (this.cache.has(cacheKey)) {
            console.log(`✅ Cache hit for ${codeContext.functionName}`);
            return this.cache.get(cacheKey)!;
        }

        try {
            const apiKey = await this.getApiKey();

            if (!apiKey) {
                throw new Error('OpenAI API Key nicht konfiguriert');
            }

            // Hole ähnliche Beispiele aus Learning System
            const similarExamples = this.learningSystem.findSimilarExamples(codeContext);
            
            // Erstelle VERBESSERTEN Prompt
            const prompt = this.buildImprovedPrompt(codeContext, similarExamples);

            console.log(`🤖 Calling GPT-4 for ${codeContext.functionType}: ${codeContext.functionName}`);

            // Rufe OpenAI API
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
                    temperature: 0.2, // Niedriger für konsistentere Outputs
                    max_tokens: 300 // Reduziert für kürzere Kommentare
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
            
            console.log(`✅ GPT Response: "${analysis.description.substring(0, 100)}..."`);
            
            // Cache Ergebnis
            this.cache.set(cacheKey, analysis);
            
            // Cache-Größe begrenzen
            if (this.cache.size > this.CACHE_SIZE) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            return analysis;

        } catch (error) {
            console.error('❌ Code analysis error:', error);
            throw new Error(`Analysefehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
        }
    }

    /**
     * ✨ NEUER, VERBESSERTER System-Prompt
     * Klare Anweisungen: NUR den Kommentar zurückgeben!
     */
    private getImprovedSystemPrompt(): string {
        return `Du bist ein Experte für Code-Dokumentation. 

WICHTIG: Gib DIREKT den Dokumentations-Text zurück, OHNE Meta-Text!

Richtlinien:
1. Beschreibe WAS der Code macht (nicht WIE)
2. Sei präzise und knapp (1-3 Sätze)
3. Verwende deutsche Sprache
4. KEINE Phrasen wie "Erstelle einen Kommentar" oder "Der Code macht"
5. Starte direkt mit der Beschreibung
6. Keine JSON-Formatierung, nur purer Text

FALSCH: "Erstellt einen JSDoc-Kommentar für die Methode..."
RICHTIG: "Verarbeitet Benutzerdaten und speichert sie in der Datenbank"

FALSCH: "Der Code führt aus..."
RICHTIG: "Führt die Authentifizierung durch und gibt ein Token zurück"`;
    }

    /**
     * ✨ VERBESSERTER Prompt - Direkte Anweisungen
     */
    private buildImprovedPrompt(codeContext: CodeContext, similarExamples: any[]): string {
        let prompt = '';
        
        // Kontext
        prompt += `Sprache: ${codeContext.languageId}\n`;
        prompt += `Element: ${codeContext.functionType} "${codeContext.functionName}"\n\n`;
        
        // Code
        prompt += `Code:\n\`\`\`${codeContext.languageId}\n${codeContext.code}\n\`\`\`\n\n`;

        // Ähnliche Beispiele für Konsistenz
        if (similarExamples && similarExamples.length > 0) {
            prompt += `Stil-Beispiele aus diesem Projekt:\n`;
            similarExamples.slice(0, 2).forEach((example, i) => {
                // Extrahiere nur den Kommentar-Text (ohne /** */ etc.)
                const cleanComment = this.extractCommentText(example.output);
                prompt += `${i + 1}. "${cleanComment}"\n`;
            });
            prompt += `\n`;
        }

        // Klare Anweisung
        prompt += `Schreibe JETZT eine kurze, präzise Dokumentation für "${codeContext.functionName}".\n`;
        prompt += `NUR die Beschreibung, KEIN Meta-Text!\n`;
        prompt += `Antworte in maximal 2 Sätzen.`;

        return prompt;
    }

    /**
     * ✨ VERBESSERTE Response-Parsing
     * Entfernt Meta-Text und extrahiert nur die Beschreibung
     */
    private parseImprovedResponse(responseData: any, codeContext: CodeContext): AnalysisResult {
        try {
            let content = responseData.choices[0].message.content.trim();
            
            // Entferne häufige Meta-Phrasen
            const metaPhrases = [
                'Erstellt einen JSDoc-Kommentar',
                'Erstelle einen professionellen JSDoc-Kommentar',
                'Der Kommentar soll beschreiben',
                'Dokumentiere die',
                'Dokumentiert die',
                'Der Code führt aus',
                'Diese Methode',
                'Diese Funktion',
                'Diese Klasse'
            ];

            for (const phrase of metaPhrases) {
                if (content.includes(phrase)) {
                    console.warn(`⚠️ Meta-Text erkannt: "${phrase}" - versuche zu bereinigen`);
                    // Wenn Meta-Text erkannt, erstelle Fallback
                    return this.createFallbackComment(codeContext);
                }
            }

            // Entferne JSON-Wrapper falls vorhanden
            const jsonMatch = content.match(/\{[\s\S]*"description":\s*"([^"]+)"[\s\S]*\}/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }

            // Entferne Anführungszeichen am Anfang/Ende
            content = content.replace(/^["']|["']$/g, '').trim();

            // Validierung: Ist es ein sinnvoller Kommentar?
            if (content.length < 10 || content.length > 500) {
                console.warn(`⚠️ Ungültige Länge (${content.length}), verwende Fallback`);
                return this.createFallbackComment(codeContext);
            }

            return {
                description: content,
                details: '',
                confidence: 0.85
            };

        } catch (error) {
            console.error('❌ Failed to parse response:', error);
            return this.createFallbackComment(codeContext);
        }
    }

    /**
     * ✨ NEU: Fallback-Kommentar wenn GPT versagt
     */
    private createFallbackComment(codeContext: CodeContext): AnalysisResult {
        let description = '';
        
        switch (codeContext.functionType) {
            case 'class':
                description = `Implementiert die ${codeContext.functionName} Klasse`;
                break;
            case 'function':
                description = `Führt ${codeContext.functionName} Operation aus`;
                break;
            case 'method':
                description = `Verarbeitet ${codeContext.functionName}`;
                break;
            default:
                description = `Implementiert ${codeContext.functionName}`;
        }

        return {
            description,
            details: 'Automatisch generierter Fallback-Kommentar',
            confidence: 0.3
        };
    }

    /**
     * Extrahiert reinen Text aus Kommentar (ohne Kommentar-Syntax)
     */
    private extractCommentText(comment: string): string {
        return comment
            .replace(/\/\*\*|\*\/|\/\*|\*|\/\/|"""|'''/g, '') // Entferne Kommentar-Zeichen
            .replace(/^\s+|\s+$/g, '') // Trim
            .replace(/\n\s*/g, ' ') // Mehrzeilen zu einer Zeile
            .substring(0, 150); // Max 150 Zeichen
    }

    /**
     * Generiert Cache-Key für Code-Kontext
     */
    private generateCacheKey(codeContext: CodeContext): string {
        const codeHash = this.simpleHash(codeContext.code);
        return `${codeContext.languageId}-${codeContext.functionName}-${codeHash}`;
    }

    /**
     * Einfacher Hash für Strings
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
     * Holt OpenAI API Key aus SecretStorage
     */
    private async getApiKey(): Promise<string | undefined> {
        // Versuche aus Environment Variable
        if (process.env.OPENAI_API_KEY) {
            return process.env.OPENAI_API_KEY;
        }
        
        // Versuche aus VS Code Secret Storage
        try {
            const { ConfigManager } = await import('../utils/configManager');
            return await ConfigManager.getSecret('openAIApiKey');
        } catch {
            return undefined;
        }
    }

    /**
     * Bereinigt Cache
     */
    clearCache(): void {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
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
