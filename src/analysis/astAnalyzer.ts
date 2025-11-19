// src/analysis/astAnalyzer.ts
// AST-basierte Code-Analyse für intelligente Kommentar-Platzierung
// ✨ Neu hinzugefügt für Diplomarbeit - Intelligente Code-Struktur-Erkennung

import { parse } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

export interface CodeElement {
    type: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type';
    name: string;
    line: number;
    endLine: number;
    hasComment: boolean;
    complexity: number;
    parameters?: Parameter[];
    returnType?: string;
    description?: string;
}

export interface Parameter {
    name: string;
    type?: string;
    optional: boolean;
}

/**
 * Analysiert TypeScript/JavaScript Code mit AST (Abstract Syntax Tree)
 * Erkennt Funktionen, Klassen, Methoden, Variablen, Interfaces
 * Berechnet Code-Komplexität und prüft Dokumentation
 */
export class ASTAnalyzer {
    /**
     * Analysiert Code und extrahiert alle relevanten Elemente
     */
    public analyzeCode(code: string, filePath: string): CodeElement[] {
        try {
            const ast = parse(code, {
                loc: true,
                range: true,
                tokens: true,
                comment: true,
                jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
            });

            const elements: CodeElement[] = [];
            
            this.traverse(ast, (node: any) => {
                const element = this.extractElement(node, code);
                if (element) {
                    elements.push(element);
                }
            });

            return elements;
        } catch (error) {
            console.error('AST parsing failed:', error);
            return [];
        }
    }

    /**
     * Findet Code-Element an spezifischer Zeile
     */
    public findElementAtLine(elements: CodeElement[], line: number): CodeElement | null {
        return elements.find(el => 
            line >= el.line && line <= el.endLine
        ) || null;
    }

    /**
     * Findet undokumentierte Elemente
     */
    public findUndocumented(elements: CodeElement[]): CodeElement[] {
        return elements.filter(el => !el.hasComment);
    }

    /**
     * Findet komplexe Funktionen (Komplexität > threshold)
     */
    public findComplexFunctions(elements: CodeElement[], threshold: number = 5): CodeElement[] {
        return elements.filter(el => 
            (el.type === 'function' || el.type === 'method') && 
            el.complexity > threshold
        );
    }

    /**
     * Extrahiert Element-Informationen aus AST-Node
     */
    private extractElement(node: any, code: string): CodeElement | null {
        switch (node.type) {
            case AST_NODE_TYPES.FunctionDeclaration:
                return this.extractFunction(node, code);
            
            case AST_NODE_TYPES.ClassDeclaration:
                return this.extractClass(node, code);
            
            case AST_NODE_TYPES.MethodDefinition:
                return this.extractMethod(node, code);
            
            case AST_NODE_TYPES.VariableDeclaration:
                return this.extractVariable(node, code);
            
            case AST_NODE_TYPES.TSInterfaceDeclaration:
                return this.extractInterface(node, code);
            
            default:
                return null;
        }
    }

    private extractFunction(node: any, code: string): CodeElement {
        return {
            type: 'function',
            name: node.id?.name || 'anonymous',
            line: node.loc.start.line,
            endLine: node.loc.end.line,
            hasComment: this.hasCommentBefore(node, code),
            complexity: this.calculateComplexity(node),
            parameters: this.extractParameters(node),
            returnType: this.extractReturnType(node)
        };
    }

    private extractClass(node: any, code: string): CodeElement {
        return {
            type: 'class',
            name: node.id?.name || 'anonymous',
            line: node.loc.start.line,
            endLine: node.loc.end.line,
            hasComment: this.hasCommentBefore(node, code),
            complexity: this.calculateComplexity(node)
        };
    }

    private extractMethod(node: any, code: string): CodeElement {
        return {
            type: 'method',
            name: node.key?.name || 'anonymous',
            line: node.loc.start.line,
            endLine: node.loc.end.line,
            hasComment: this.hasCommentBefore(node, code),
            complexity: this.calculateComplexity(node),
            parameters: this.extractParameters(node.value)
        };
    }

    private extractVariable(node: any, code: string): CodeElement | null {
        const declaration = node.declarations[0];
        if (!declaration?.id) return null;

        return {
            type: 'variable',
            name: declaration.id.name,
            line: node.loc.start.line,
            endLine: node.loc.end.line,
            hasComment: this.hasCommentBefore(node, code),
            complexity: 1
        };
    }

    private extractInterface(node: any, code: string): CodeElement {
        return {
            type: 'interface',
            name: node.id?.name || 'anonymous',
            line: node.loc.start.line,
            endLine: node.loc.end.line,
            hasComment: this.hasCommentBefore(node, code),
            complexity: 1
        };
    }

    /**
     * Prüft ob Element bereits einen Kommentar hat
     */
    private hasCommentBefore(node: any, code: string): boolean {
        const line = node.loc.start.line;
        const lines = code.split('\n');
        
        if (line > 1) {
            const previousLine = lines[line - 2].trim();
            
            // JSDoc
            if (previousLine.includes('*/') || previousLine.includes('/**')) {
                return true;
            }
            
            // Single-line
            if (previousLine.startsWith('//')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Berechnet zyklomatische Komplexität (McCabe)
     */
    private calculateComplexity(node: any): number {
        let complexity = 1;
        
        this.traverse(node, (child: any) => {
            switch (child.type) {
                case AST_NODE_TYPES.IfStatement:
                case AST_NODE_TYPES.WhileStatement:
                case AST_NODE_TYPES.ForStatement:
                case AST_NODE_TYPES.ForInStatement:
                case AST_NODE_TYPES.ForOfStatement:
                case AST_NODE_TYPES.CaseClause:
                case AST_NODE_TYPES.ConditionalExpression:
                case AST_NODE_TYPES.LogicalExpression:
                    complexity++;
                    break;
            }
        });
        
        return complexity;
    }

    private extractParameters(node: any): Parameter[] {
        if (!node?.params) return [];
        
        return node.params.map((param: any) => ({
            name: param.name || param.left?.name || 'unknown',
            type: param.typeAnnotation?.typeAnnotation?.typeName?.name,
            optional: param.optional || false
        }));
    }

    private extractReturnType(node: any): string | undefined {
        return node.returnType?.typeAnnotation?.typeName?.name;
    }

    /**
     * Traversiert AST rekursiv
     */
    private traverse(node: any, callback: (node: any) => void): void {
        if (!node || typeof node !== 'object') return;
        
        callback(node);
        
        Object.keys(node).forEach(key => {
            const child = node[key];
            
            if (Array.isArray(child)) {
                child.forEach(item => this.traverse(item, callback));
            } else if (child && typeof child === 'object') {
                this.traverse(child, callback);
            }
        });
    }

    /**
     * Generiert Code-Statistik
     */
    public getStatistics(elements: CodeElement[]): {
        total: number;
        documented: number;
        undocumented: number;
        byType: { [key: string]: number };
        avgComplexity: number;
    } {
        const documented = elements.filter(el => el.hasComment).length;
        const undocumented = elements.filter(el => !el.hasComment).length;
        
        const byType: { [key: string]: number } = {};
        elements.forEach(el => {
            byType[el.type] = (byType[el.type] || 0) + 1;
        });

        const avgComplexity = elements.length > 0
            ? elements.reduce((sum, el) => sum + el.complexity, 0) / elements.length
            : 0;

        return {
            total: elements.length,
            documented,
            undocumented,
            byType,
            avgComplexity
        };
    }
}
