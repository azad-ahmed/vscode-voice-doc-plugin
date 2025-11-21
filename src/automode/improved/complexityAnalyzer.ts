import * as vscode from 'vscode';

/**
 * Analyzes code complexity for intelligent auto-commenting decisions
 * 
 * Calculates complexity based on:
 * - Control structures (if, for, while, switch)
 * - Nesting depth
 * - Number of parameters
 * - Lines of code
 * - Logical operators
 */
export class ComplexityAnalyzer {
    
    /**
     * Analyzes code complexity of an element
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
     * Calculates cyclomatic complexity
     */
    private static calculateCyclomaticComplexity(code: string): number {
        let complexity = 1;
        
        complexity += (code.match(/\bif\s*\(/g) || []).length;
        complexity += (code.match(/\belse\s+if\s*\(/g) || []).length;
        complexity += (code.match(/\bfor\s*\(/g) || []).length;
        complexity += (code.match(/\bwhile\s*\(/g) || []).length;
        complexity += (code.match(/\bcase\s+/g) || []).length;
        complexity += (code.match(/\bcatch\s*\(/g) || []).length;
        complexity += (code.match(/\bdo\s*{/g) || []).length;
        complexity += (code.match(/\?\s*.*\s*:/g) || []).length;
        
        return complexity;
    }
    
    /**
     * Calculates maximum nesting depth
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
     * Counts function parameters
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
     * Counts logical operators
     */
    private static countLogicalOperators(code: string): number {
        return (code.match(/&&|\|\|/g) || []).length;
    }
    
    /**
     * Counts existing comments
     */
    private static countComments(code: string): number {
        const singleLine = (code.match(/\/\/.*/g) || []).length;
        const multiLine = (code.match(/\/\*[\s\S]*?\*\//g) || []).length;
        return singleLine + multiLine;
    }
    
    /**
     * Calculates total complexity score (0-100)
     */
    private static calculateTotalComplexity(metrics: ComplexityMetrics): number {
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
        
        return Math.min(100, Math.round(score));
    }
    
    /**
     * Determines if code should be documented based on complexity
     */
    private static shouldDocument(complexity: number, metrics: ComplexityMetrics): boolean {
        const MIN_COMPLEXITY = 15;
        const MIN_LINES = 5;
        const MIN_PARAMS = 3;
        
        if (complexity >= MIN_COMPLEXITY) {
            return true;
        }
        
        if (metrics.parameterCount >= MIN_PARAMS) {
            return true;
        }
        
        if (metrics.linesOfCode >= 20 && metrics.comments === 0) {
            return true;
        }
        
        if (metrics.nestingDepth >= 4) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Categorizes complexity level
     */
    private static getComplexityLevel(complexity: number): ComplexityLevel {
        if (complexity < 10) return 'trivial';
        if (complexity < 20) return 'low';
        if (complexity < 40) return 'medium';
        if (complexity < 60) return 'high';
        return 'very-high';
    }
    
    /**
     * Finds end of code block
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
        
        return Math.min(startLine + 50, document.lineCount - 1);
    }
    
    /**
     * Gets code block as string
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

export interface ComplexityMetrics {
    cyclomaticComplexity: number;
    nestingDepth: number;
    linesOfCode: number;
    parameterCount: number;
    logicalOperators: number;
    comments: number;
}

export interface ComplexityResult {
    name: string;
    startLine: number;
    endLine: number;
    metrics: ComplexityMetrics;
    totalComplexity: number;
    needsDocumentation: boolean;
    complexityLevel: ComplexityLevel;
}

export type ComplexityLevel = 'trivial' | 'low' | 'medium' | 'high' | 'very-high';
