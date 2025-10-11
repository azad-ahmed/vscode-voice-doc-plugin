import * as vscode from 'vscode';
import axios from 'axios';
import { LearningSystem } from '../learning/learningSystem';

/**
 * Code Analyzer Service - Analysiert Code automatisch mit GPT-4
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
            return this.cache.get(cacheKey)!;
        }

        try {
            const apiKey = await this.getApiKey();

            if (!apiKey) {
                throw new Error('OpenAI API Key nicht konfiguriert');
            }

            // Hole ähnliche Beispiele aus Learning System
            const similarExamples = this.learningSystem.findSimilarExamples(codeContext);
            
            // Erstelle Prompt mit Kontext
            const prompt = this.buildAnalysisPrompt(codeContext, similarExamples);

            // Rufe OpenAI API
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: this.getSystemPrompt()
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const analysis = this.parseAnalysisResponse(response.data);
            
            // Cache Ergebnis
            this.cache.set(cacheKey, analysis);
            
            // Cache-Größe begrenzen
            if (this.cache.size > this.CACHE_SIZE) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            return analysis;

        } catch (error) {
            console.error('Code analysis error:', error);
            throw new Error(`Analysefehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
        }
    }

    /**
     * Erstellt System-Prompt für Code-Analyse
     */
    private getSystemPrompt(): string {
        return `Du bist ein Experte für Code-Dokumentation. Deine Aufgabe ist es, Code zu analysieren und präzise, hilfreiche Dokumentation zu erstellen.

Richtlinien:
1. Erkläre WAS der Code macht und WARUM (nicht nur wie)
2. Beschreibe wichtige Parameter und Rückgabewerte
3. Erwähne Besonderheiten, Edge Cases oder potenzielle Probleme
4. Verwende eine klare, technisch präzise Sprache
5. Halte dich kurz aber informativ (2-4 Sätze)
6. Berücksichtige den Kontext und vorhandene Code-Patterns

Antwort-Format:
{
  "description": "Hauptbeschreibung der Funktionalität",
  "details": "Zusätzliche technische Details",
  "confidence": 0.0-1.0 (Deine Einschätzung wie sicher die Analyse ist)
}`;
    }

    /**
     * Erstellt Analyse-Prompt mit Kontext
     */
    private buildAnalysisPrompt(codeContext: CodeContext, similarExamples: any[]): string {
        let prompt = `Analysiere folgenden Code und erstelle eine präzise Dokumentation:\n\n`;
        
        prompt += `**Programmiersprache:** ${codeContext.languageId}\n`;
        prompt += `**Kontext:** ${codeContext.functionType} "${codeContext.functionName}"\n\n`;
        prompt += `**Code:**\n\`\`\`${codeContext.languageId}\n${codeContext.code}\n\`\`\`\n\n`;

        // Füge ähnliche Beispiele hinzu wenn vorhanden
        if (similarExamples && similarExamples.length > 0) {
            prompt += `**Ähnliche dokumentierte Beispiele aus diesem Projekt:**\n`;
            similarExamples.slice(0, 3).forEach((example, i) => {
                prompt += `\nBeispiel ${i + 1}:\n`;
                prompt += `Code: ${example.codeContext.code.substring(0, 100)}...\n`;
                prompt += `Dokumentation: ${example.output.substring(0, 150)}...\n`;
            });
            prompt += `\nOrientiere dich am Stil dieser Beispiele für Konsistenz.\n\n`;
        }

        prompt += `Erstelle nun eine passende Dokumentation im JSON-Format.`;

        return prompt;
    }

    /**
     * Parst Analyse-Response
     */
    private parseAnalysisResponse(responseData: any): AnalysisResult {
        try {
            const content = responseData.choices[0].message.content;
            
            // Versuche JSON zu extrahieren
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    description: parsed.description || content,
                    details: parsed.details || '',
                    confidence: parsed.confidence || 0.5
                };
            }
            
            // Fallback: Verwende ganzen Text
            return {
                description: content,
                details: '',
                confidence: 0.5
            };

        } catch (error) {
            console.error('Failed to parse analysis response:', error);
            return {
                description: responseData.choices[0].message.content,
                details: '',
                confidence: 0.3
            };
        }
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

// Für Kompatibilität mit bestehendem Code
export interface CodeElement {
    type: 'function' | 'class' | 'method';
    name: string;
    line: number;
    hasComment: boolean;
    complexity?: number;
}
