import * as vscode from 'vscode';

/**
 * 📊 Analysiert Code-Komplexität für intelligentere Auto-Kommentare
 * 
 * Berechnet Komplexität basierend auf:
 * - Kontrollstrukturen (if, for, while, switch)
 * - Verschachtelungstiefe
 * - Anzahl der Parameter
 * - Codezeilen
 * - Logische Operatoren
 */
export class ComplexityAnalyzer {
    
    /**
     * Analysiert Code-Komplexität eines Elements
     */
    static analyzeComplexity(
        document: vscode.TextDocument,
        startLine: number,
        name: string
    ): ComplexityResult {
        const endLine = this.findCodeBlockEnd(document, startLine);
        const codeBlock = this.getCodeBlock(document, startLine, endLine);
        
        const metrics = {
            cyclomaticComplexity: this.calculateCyclomaticComplexity(codeBlock),
            nestingDepth: this.calculateNestingDepth(codeBlock),
            linesOfCode: endLine - startLine,
            parameterCount: this.countParameters(document.lineAt(startLine).text),
            logicalOperators: this.countLogicalOperators(codeBlock),
            comments: this.countComments(codeBlock)
        };
        
        const totalComplexity = this.calculateTotalComplexity(metrics);
        const needsDocumentation = this.shouldDocument(totalComplexity, metrics);
        
        return {
            name,
            startLine,
            endLine,
            metrics,
            totalComplexity,
            needsDocumentation,
            complexityLevel: this.getComplexityLevel(totalComplexity)
        };
    }
    
    /**
     * Berechnet Zyklomatische Komplexität
     */
    private static calculateCyclomaticComplexity(code: string): number {
        let complexity = 1; // Basis-Pfad
        
        // Zähle Entscheidungspunkte
        complexity += (code.match(/\bif\s*\(/g) || []).length;
        complexity += (code.match(/\belse\s+if\s*\(/g) || []).length;
        complexity += (code.match(/\bfor\s*\(/g) || []).length;
        complexity += (code.match(/\bwhile\s*\(/g) || []).length;
        complexity += (code.match(/\bcase\s+/g) || []).length;
        complexity += (code.match(/\bcatch\s*\(/g) || []).length;
        complexity += (code.match(/\bdo\s*{/g) || []).length;
        complexity += (code.match(/\?\s*.*\s*:/g) || []).length; // Ternäre Operatoren
        
        return complexity;
    }
    
    /**
     * Berechnet maximale Verschachtelungstiefe
     */
    private static calculateNestingDepth(code: string): number {
        let maxDepth = 0;
        let currentDepth = 0;
        
        for (const char of code) {
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth--;
            }
        }
        
        return maxDepth;
    }
    
    /**
     * Zählt Parameter einer Funktion
     */
    private static countParameters(functionLine: string): number {
        const match = functionLine.match(/\(([^)]*)\)/);
        if (!match || !match[1].trim()) {
            return 0;
        }
        
        const params = match[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
        return params.length;
    }
    
    /**
     * Zählt logische Operatoren (&&, ||)
     */
    private static countLogicalOperators(code: string): number {
        return (code.match(/&&|\|\|/g) || []).length;
    }
    
    /**
     * Zählt existierende Kommentare
     */
    private static countComments(code: string): number {
        const singleLine = (code.match(/\/\/.*/g) || []).length;
        const multiLine = (code.match(/\/\*[\s\S]*?\*\//g) || []).length;
        return singleLine + multiLine;
    }
    
    /**
     * Berechnet Gesamt-Komplexität (0-100)
     */
    private static calculateTotalComplexity(metrics: ComplexityMetrics): number {
        // Gewichtete Berechnung
        const weights = {
            cyclomatic: 10,
            nesting: 5,
            lines: 0.5,
            params: 3,
            logical: 2
        };
        
        const score = 
            (metrics.cyclomaticComplexity * weights.cyclomatic) +
            (metrics.nestingDepth * weights.nesting) +
            (metrics.linesOfCode * weights.lines) +
            (metrics.parameterCount * weights.params) +
            (metrics.logicalOperators * weights.logical);
        
        // Normalisiere auf 0-100
        return Math.min(100, Math.round(score));
    }
    
    /**
     * Entscheidet ob Code dokumentiert werden sollte
     */
    private static shouldDocument(complexity: number, metrics: ComplexityMetrics): boolean {
        // Minimale Schwellwerte
        const MIN_COMPLEXITY = 15; // Angepasst von 20 auf 15
        const MIN_LINES = 5;
        const MIN_PARAMS = 3;
        
        // Dokumentiere wenn:
        // 1. Komplexität über Schwellwert
        if (complexity >= MIN_COMPLEXITY) {
            return true;
        }
        
        // 2. Viele Parameter (auch bei niedriger Komplexität)
        if (metrics.parameterCount >= MIN_PARAMS) {
            return true;
        }
        
        // 3. Lange Funktion ohne Kommentare
        if (metrics.linesOfCode >= 20 && metrics.comments === 0) {
            return true;
        }
        
        // 4. Hohe Verschachtelung
        if (metrics.nestingDepth >= 4) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Kategorisiert Komplexitätslevel
     */
    private static getComplexityLevel(complexity: number): ComplexityLevel {
        if (complexity < 10) return 'trivial';
        if (complexity < 20) return 'low';
        if (complexity < 40) return 'medium';
        if (complexity < 60) return 'high';
        return 'very-high';
    }
    
    /**
     * Findet Ende des Code-Blocks
     */
    private static findCodeBlockEnd(document: vscode.TextDocument, startLine: number): number {
        let braceCount = 0;
        let foundStart = false;
        
        for (let i = startLine; i < Math.min(startLine + 200, document.lineCount); i++) {
            const line = document.lineAt(i).text;
            
            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    foundStart = true;
                } else if (char === '}') {
                    braceCount--;
                    if (foundStart && braceCount === 0) {
                        return i;
                    }
                }
            }
        }
        
        // Fallback: Max 50 Zeilen
        return Math.min(startLine + 50, document.lineCount - 1);
    }
    
    /**
     * Holt Code-Block als String
     */
    private static getCodeBlock(
        document: vscode.TextDocument,
        startLine: number,
        endLine: number
    ): string {
        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        );
        return document.getText(range);
    }
}

/**
 * Komplexitäts-Metriken
 */
export interface ComplexityMetrics {
    cyclomaticComplexity: number;
    nestingDepth: number;
    linesOfCode: number;
    parameterCount: number;
    logicalOperators: number;
    comments: number;
}

/**
 * Komplexitäts-Analyse Ergebnis
 */
export interface ComplexityResult {
    name: string;
    startLine: number;
    endLine: number;
    metrics: ComplexityMetrics;
    totalComplexity: number;
    needsDocumentation: boolean;
    complexityLevel: ComplexityLevel;
}

/**
 * Komplexitätsstufen
 */
export type ComplexityLevel = 'trivial' | 'low' | 'medium' | 'high' | 'very-high';
