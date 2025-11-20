import * as vscode from 'vscode';
import { CodeElement } from '../types/codeAnalysis';

/**
 * Analysiert Code-Kontext für intelligenteres Comment-Learning
 */
export class CodeContextAnalyzer {
    /**
     * Analysiert den aktuellen Code-Kontext an der Cursor-Position
     */
    analyzeCurrentContext(
        editor: vscode.TextEditor,
        position: vscode.Position
    ): CodeContext {
        const document = editor.document;
        const languageId = document.languageId;
        const line = document.lineAt(position.line);
        
        // Extrahiere umgebenden Code
        const contextLines = this.getContextLines(document, position, 5);
        const codeBlock = contextLines.join('\n');
        
        // Erkenne Code-Pattern
        const pattern = this.detectPattern(codeBlock, languageId);
        
        // Extrahiere Code-Element Info
        const codeElement = this.extractCodeElement(codeBlock, languageId);
        
        // Berechne Komplexität
        const complexity = this.calculateComplexity(codeBlock);
        
        return {
            languageId,
            position: {
                line: position.line,
                character: position.character
            },
            pattern,
            codeElement,
            complexity,
            surroundingCode: codeBlock,
            hasExistingComments: this.hasNearbyComments(document, position)
        };
    }
    
    /**
     * Erkennt Code-Patterns (Funktion, Klasse, Variable, etc.)
     */
    private detectPattern(code: string, languageId: string): CodePattern {
        const patterns: PatternDetectionRule[] = [
            {
                type: 'function',
                regex: /function\s+(\w+)\s*\(/,
                confidence: 0.9
            },
            {
                type: 'arrow-function',
                regex: /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/,
                confidence: 0.85
            },
            {
                type: 'class',
                regex: /class\s+(\w+)/,
                confidence: 0.95
            },
            {
                type: 'method',
                regex: /(\w+)\s*\([^)]*\)\s*[:{]/,
                confidence: 0.8
            },
            {
                type: 'variable',
                regex: /(const|let|var)\s+(\w+)\s*=/,
                confidence: 0.7
            },
            {
                type: 'async-function',
                regex: /async\s+(function\s+)?(\w+)?/,
                confidence: 0.85
            },
            {
                type: 'interface',
                regex: /interface\s+(\w+)/,
                confidence: 0.9
            },
            {
                type: 'type-definition',
                regex: /type\s+(\w+)\s*=/,
                confidence: 0.85
            }
        ];
        
        for (const rule of patterns) {
            const match = code.match(rule.regex);
            if (match) {
                return {
                    type: rule.type,
                    name: match[1] || match[2] || 'anonymous',
                    confidence: rule.confidence,
                    languageId
                };
            }
        }
        
        return {
            type: 'unknown',
            name: '',
            confidence: 0.3,
            languageId
        };
    }
    
    /**
     * Extrahiert detaillierte Code-Element-Informationen
     */
    private extractCodeElement(code: string, languageId: string): CodeElementInfo {
        const element: CodeElementInfo = {
            hasParameters: false,
            parameterCount: 0,
            hasReturnType: false,
            isAsync: code.includes('async'),
            isExported: code.includes('export'),
            keywords: []
        };
        
        // Erkenne Parameter
        const paramMatch = code.match(/\(([^)]*)\)/);
        if (paramMatch && paramMatch[1].trim()) {
            element.hasParameters = true;
            element.parameterCount = paramMatch[1].split(',').length;
            element.parameters = paramMatch[1]
                .split(',')
                .map(p => p.trim().split(/[:\s]+/)[0]);
        }
        
        // Erkenne Return-Type (TypeScript)
        const returnTypeMatch = code.match(/\):\s*(\w+)/);
        if (returnTypeMatch) {
            element.hasReturnType = true;
            element.returnType = returnTypeMatch[1];
        }
        
        // Extrahiere Keywords für besseres Matching
        element.keywords = this.extractKeywords(code);
        
        return element;
    }
    
    /**
     * Extrahiert wichtige Keywords aus dem Code
     */
    private extractKeywords(code: string): string[] {
        // Entferne Kommentare
        const cleanCode = code
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Extrahiere Identifier
        const keywords = cleanCode.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) || [];
        
        // Filtere häufige Keywords und Duplikate
        const stopWords = new Set([
            'const', 'let', 'var', 'function', 'return', 'if', 'else',
            'for', 'while', 'class', 'interface', 'type', 'async', 'await'
        ]);
        
        return [...new Set(keywords)]
            .filter(k => !stopWords.has(k.toLowerCase()))
            .slice(0, 10); // Top 10 Keywords
    }
    
    /**
     * Berechnet Code-Komplexität (einfache Metrik)
     */
    private calculateComplexity(code: string): number {
        let complexity = 1;
        
        // Zähle Kontrollstrukturen
        const controlStructures = [
            /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g,
            /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\b\?\b/g
        ];
        
        controlStructures.forEach(regex => {
            const matches = code.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        });
        
        return complexity;
    }
    
    /**
     * Holt umgebende Zeilen um die aktuelle Position
     */
    private getContextLines(
        document: vscode.TextDocument,
        position: vscode.Position,
        radius: number
    ): string[] {
        const lines: string[] = [];
        const startLine = Math.max(0, position.line - radius);
        const endLine = Math.min(document.lineCount - 1, position.line + radius);
        
        for (let i = startLine; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
        }
        
        return lines;
    }
    
    /**
     * Prüft, ob in der Nähe bereits Kommentare existieren
     */
    private hasNearbyComments(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const checkRadius = 3;
        const startLine = Math.max(0, position.line - checkRadius);
        const endLine = Math.min(document.lineCount - 1, position.line + checkRadius);
        
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i).text.trim();
            if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Vergleicht zwei Kontexte für Ähnlichkeit (0-1)
     */
    calculateContextSimilarity(context1: CodeContext, context2: CodeContext): number {
        let score = 0;
        let weights = 0;
        
        // Sprache muss übereinstimmen
        if (context1.languageId !== context2.languageId) {
            return 0;
        }
        
        // Pattern-Type (40% Gewicht)
        if (context1.pattern.type === context2.pattern.type) {
            score += 0.4;
        }
        weights += 0.4;
        
        // Komplexität ähnlich (20% Gewicht)
        const complexityDiff = Math.abs(context1.complexity - context2.complexity);
        const complexitySimilarity = Math.max(0, 1 - (complexityDiff / 10));
        score += complexitySimilarity * 0.2;
        weights += 0.2;
        
        // Keywords Überschneidung (30% Gewicht)
        const keywords1 = context1.codeElement.keywords || [];
        const keywords2 = context2.codeElement.keywords || [];
        const keywordSimilarity = this.calculateKeywordSimilarity(keywords1, keywords2);
        score += keywordSimilarity * 0.3;
        weights += 0.3;
        
        // Parameter-Anzahl ähnlich (10% Gewicht)
        if (context1.codeElement.hasParameters && context2.codeElement.hasParameters) {
            const paramDiff = Math.abs(
                context1.codeElement.parameterCount - context2.codeElement.parameterCount
            );
            const paramSimilarity = Math.max(0, 1 - (paramDiff / 5));
            score += paramSimilarity * 0.1;
        }
        weights += 0.1;
        
        return weights > 0 ? score / weights : 0;
    }
    
    /**
     * Berechnet Ähnlichkeit zwischen Keyword-Listen
     */
    private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
        if (keywords1.length === 0 || keywords2.length === 0) {
            return 0;
        }
        
        const set1 = new Set(keywords1.map(k => k.toLowerCase()));
        const set2 = new Set(keywords2.map(k => k.toLowerCase()));
        
        const intersection = [...set1].filter(k => set2.has(k));
        const union = new Set([...set1, ...set2]);
        
        return union.size > 0 ? intersection.length / union.size : 0;
    }
}

// ===== INTERFACES =====

export interface CodeContext {
    languageId: string;
    position: {
        line: number;
        character: number;
    };
    pattern: CodePattern;
    codeElement: CodeElementInfo;
    complexity: number;
    surroundingCode: string;
    hasExistingComments: boolean;
}

export interface CodePattern {
    type: 'function' | 'arrow-function' | 'class' | 'method' | 'variable' | 
          'async-function' | 'interface' | 'type-definition' | 'unknown';
    name: string;
    confidence: number;
    languageId: string;
}

export interface CodeElementInfo {
    hasParameters: boolean;
    parameterCount: number;
    parameters?: string[];
    hasReturnType: boolean;
    returnType?: string;
    isAsync: boolean;
    isExported: boolean;
    keywords: string[];
}

interface PatternDetectionRule {
    type: CodePattern['type'];
    regex: RegExp;
    confidence: number;
}
