import * as vscode from 'vscode';
import axios from 'axios';
import { ConfigManager } from '../utils/configManager';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Nutzt Claude API für intelligente Code-Analyse und Kommentar-Platzierung
 * 
 * Dieser Service sendet Code an Claude (mich!) und erhält zurück:
 * 1. Den optimalen Kommentar-Text
 * 2. Die EXAKTE Position (Zeile) wo der Kommentar hin muss
 * 3. Ob vor oder nach der Zeile eingefügt werden soll
 * 4. Die korrekte Einrückung
 */
export class ClaudeAnalyzer {
    private static readonly API_URL = 'https://api.anthropic.com/v1/messages';
    private static readonly MODEL = 'claude-sonnet-4-20250514';
    private static readonly MAX_TOKENS = 2000;

    /**
     * Analysiert Code-Kontext und gibt intelligente Kommentar-Platzierung zurück
     */
    static async analyzeAndPlaceComment(
        document: vscode.TextDocument,
        cursorLine: number,
        transcribedText: string
    ): Promise<CommentPlacement | null> {
        try {
            const apiKey = await ConfigManager.getSecret('openAIApiKey');
            if (!apiKey) {
                ErrorHandler.log('ClaudeAnalyzer', 'Kein OpenAI API Key vorhanden');
                return null;
            }

            // Extrahiere Code-Kontext (20 Zeilen vor/nach Cursor)
            const context = this.extractCodeContext(document, cursorLine);
            
            // Sende an Claude für intelligente Analyse
            const placement = await this.requestClaudeAnalysis(
                context,
                transcribedText,
                document.languageId,
                apiKey
            );

            return placement;

        } catch (error: any) {
            ErrorHandler.handleError('ClaudeAnalyzer.analyzeAndPlaceComment', error);
            return null;
        }
    }

    /**
     * Extrahiert relevanten Code-Kontext um die Cursor-Position
     */
    private static extractCodeContext(
        document: vscode.TextDocument,
        cursorLine: number
    ): CodeContext {
        const startLine = Math.max(0, cursorLine - 20);
        const endLine = Math.min(document.lineCount - 1, cursorLine + 20);

        const lines: string[] = [];
        const lineNumbers: number[] = [];

        for (let i = startLine; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
            lineNumbers.push(i);
        }

        return {
            code: lines.join('\n'),
            cursorLine: cursorLine,
            cursorLineRelative: cursorLine - startLine,
            startLine: startLine,
            endLine: endLine,
            languageId: document.languageId,
            filePath: document.fileName
        };
    }

    /**
     * Sendet Code-Kontext an Claude API für intelligente Analyse
     */
    private static async requestClaudeAnalysis(
        context: CodeContext,
        userInput: string,
        languageId: string,
        apiKey: string
    ): Promise<CommentPlacement> {
        const prompt = this.buildClaudePrompt(context, userInput, languageId);

        ErrorHandler.log('ClaudeAnalyzer', 'Sende Anfrage an Claude API...');

        const response = await axios.post(
            this.API_URL,
            {
                model: this.MODEL,
                max_tokens: this.MAX_TOKENS,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000
            }
        );

        const claudeResponse = response.data.content[0].text;
        ErrorHandler.log('ClaudeAnalyzer', `Claude Antwort erhalten: ${claudeResponse.substring(0, 100)}...`);

        // Parse Claude's strukturierte Antwort
        const placement = this.parseClaudeResponse(claudeResponse, context);

        return placement;
    }

    /**
     * Baut den intelligenten Prompt für Claude
     */
    private static buildClaudePrompt(
        context: CodeContext,
        userInput: string,
        languageId: string
    ): string {
        return `Du bist ein Experte für Code-Dokumentation und musst einen Kommentar PRÄZISE platzieren, ohne Syntaxfehler zu verursachen.

**DEINE AUFGABE:**
1. Analysiere den Code-Kontext
2. Generiere einen professionellen Kommentar für: "${userInput}"
3. Bestimme die EXAKTE Zeile, wo der Kommentar hin muss
4. Gib an, ob BEFORE oder AFTER dieser Zeile
5. Bestimme die korrekte Einrückung

**CODE-KONTEXT:**
Sprache: ${languageId}
Cursor-Position: Zeile ${context.cursorLineRelative} (relativ), Zeile ${context.cursorLine} (absolut)

\`\`\`${languageId}
${context.code}
\`\`\`

**WICHTIGE REGELN:**
1. Kommentare müssen VOR der Funktion/Klasse/Methode stehen
2. Kommentare müssen die gleiche Einrückung wie der Code haben
3. Bei ${languageId}:
   ${this.getLanguageSpecificRules(languageId)}
4. NIEMALS Kommentare in Code-Blöcke einfügen (innerhalb von {})
5. Funktions-Kommentare: DIREKT vor der Funktionsdefinition
6. Klassen-Kommentare: DIREKT vor der Klassendefinition
7. Bei leeren Zeilen: Platziere NACH der leeren Zeile

**AUSGABEFORMAT (JSON):**
{
  "comment": "Der formatierte Kommentar-Text",
  "targetLine": <absolute Zeilennummer>,
  "position": "BEFORE" oder "AFTER",
  "indentation": <Anzahl Leerzeichen>,
  "reasoning": "Kurze Erklärung warum diese Position"
}

**BEISPIEL:**
Wenn der User sagt "Diese Funktion berechnet die Summe" und der Cursor auf Zeile 5 ist, wo eine Funktion startet:
{
  "comment": "/**\\n * Berechnet die Summe von zwei Zahlen\\n */",
  "targetLine": 5,
  "position": "BEFORE",
  "indentation": 4,
  "reasoning": "Kommentar muss vor Funktionsdefinition stehen"
}

Analysiere jetzt den Code und gib NUR das JSON zurück, KEINE zusätzlichen Erklärungen!`;
    }

    /**
     * Sprachspezifische Regeln
     */
    private static getLanguageSpecificRules(languageId: string): string {
        const rules: { [key: string]: string } = {
            'typescript': `
   - Nutze JSDoc-Stil: /** ... */
   - @param für Parameter, @returns für Rückgabewerte
   - Interfaces und Types: /** Beschreibung */ davor`,
            
            'javascript': `
   - Nutze JSDoc-Stil: /** ... */
   - @param für Parameter, @returns für Rückgabewerte`,
            
            'python': `
   - Nutze Docstrings: """..."""
   - Direkt NACH der Funktionsdefinition (nach def-Zeile)
   - Args, Returns, Raises sections`,
            
            'java': `
   - Nutze JavaDoc: /** ... */
   - @param, @return, @throws Tags`,
            
            'csharp': `
   - Nutze XML-Kommentare: /// <summary>
   - <param>, <returns> Tags`,
            
            'php': `
   - Nutze PHPDoc: /** ... */
   - @param, @return Tags`,
            
            'go': `
   - Nutze // für Kommentare
   - Kommentar beginnt mit Funktionsname`,
            
            'rust': `
   - Nutze /// für Dokumentations-Kommentare
   - Markdown-formatiert`
        };

        return rules[languageId] || '- Nutze Standard-Kommentar-Stil der Sprache';
    }

    /**
     * Parsed Claude's strukturierte JSON-Antwort
     */
    private static parseClaudeResponse(
        claudeResponse: string,
        context: CodeContext
    ): CommentPlacement {
        try {
            // Entferne mögliche Markdown-Blöcke
            let jsonText = claudeResponse.trim();
            jsonText = jsonText.replace(/```json\n?/g, '');
            jsonText = jsonText.replace(/```\n?/g, '');
            jsonText = jsonText.trim();

            const parsed = JSON.parse(jsonText);

            return {
                comment: parsed.comment,
                targetLine: parsed.targetLine,
                position: parsed.position === 'AFTER' ? 'after' : 'before',
                indentation: parsed.indentation || 0,
                reasoning: parsed.reasoning || 'Claude-optimierte Platzierung'
            };

        } catch (error) {
            ErrorHandler.handleError('ClaudeAnalyzer.parseClaudeResponse', error);
            
            // Fallback: Nutze naive Platzierung
            ErrorHandler.log('ClaudeAnalyzer', 'Fallback auf naive Platzierung');
            return {
                comment: claudeResponse,
                targetLine: context.cursorLine,
                position: 'before',
                indentation: 0,
                reasoning: 'Fallback-Platzierung'
            };
        }
    }

    /**
     * Prüft ob Claude API verfügbar ist
     */
    static async isAvailable(): Promise<boolean> {
        try {
            const apiKey = await ConfigManager.getSecret('openAIApiKey');
            return !!apiKey;
        } catch {
            return false;
        }
    }
}

/**
 * Code-Kontext für Analyse
 */
export interface CodeContext {
    code: string;              // Der Code-Text
    cursorLine: number;        // Absolute Zeile im Dokument
    cursorLineRelative: number; // Relative Zeile im Kontext
    startLine: number;         // Start des Kontexts
    endLine: number;           // Ende des Kontexts
    languageId: string;        // Programmiersprache
    filePath: string;          // Dateipfad
}

/**
 * Kommentar-Platzierungs-Information von Claude
 */
export interface CommentPlacement {
    comment: string;           // Der formatierte Kommentar
    targetLine: number;        // Absolute Zeilennummer
    position: 'before' | 'after'; // Vor oder nach der Zeile
    indentation: number;       // Anzahl Leerzeichen
    reasoning: string;         // Erklärung warum diese Position
}
