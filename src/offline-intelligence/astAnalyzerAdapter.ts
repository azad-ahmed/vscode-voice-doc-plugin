// Adapter für IntelligentPlacer - vereinfachte API
import { ASTCodeAnalyzer, CodeStructure } from './astAnalyzer';
import * as ts from 'typescript';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Code-Element (vereinfacht für IntelligentPlacer)
 */
export interface CodeElement {
    type: string;
    name: string;
    line: number;
    complexity: number;
    hasComment: boolean;
    parameters?: Array<{ name: string; type?: string }>;
    returnType?: string;
}

/**
 * Statistiken
 */
export interface CodeStatistics {
    total: number;
    documented: number;
    undocumented: number;
    avgComplexity: number;
    byType: { [key: string]: number };
}

/**
 * Adapter-Klasse für IntelligentPlacer
 * Nutzt ASTCodeAnalyzer und konvertiert in vereinfachtes Format
 */
export class ASTAnalyzer {
    /**
     * Analysiert Code und gibt vereinfachte CodeElement-Liste zurück
     */
    analyzeCode(code: string, fileName: string): CodeElement[] {
        try {
            // Erstelle SourceFile mit TypeScript Compiler API
            const sourceFile = ts.createSourceFile(
                fileName,
                code,
                ts.ScriptTarget.Latest,
                true
            );

            const elements: CodeElement[] = [];

            // Durchlaufe AST und sammle alle relevanten Nodes
            const visit = (node: ts.Node) => {
                const element = this.convertNodeToElement(node, sourceFile, code);
                if (element) {
                    elements.push(element);
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);

            ErrorHandler.log('ASTAnalyzer', `Gefunden: ${elements.length} Code-Elemente`, 'success');
            return elements;

        } catch (error: any) {
            ErrorHandler.handleError('ASTAnalyzer.analyzeCode', error);
            return [];
        }
    }

    /**
     * Konvertiert TypeScript Node in CodeElement
     */
    private convertNodeToElement(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        code: string
    ): CodeElement | null {
        let element: CodeElement | null = null;

        if (ts.isFunctionDeclaration(node)) {
            element = this.analyzeFunctionDeclaration(node, sourceFile, code);
        } else if (ts.isClassDeclaration(node)) {
            element = this.analyzeClassDeclaration(node, sourceFile, code);
        } else if (ts.isMethodDeclaration(node)) {
            element = this.analyzeMethodDeclaration(node, sourceFile, code);
        } else if (ts.isInterfaceDeclaration(node)) {
            element = this.analyzeInterfaceDeclaration(node, sourceFile, code);
        } else if (ts.isVariableStatement(node)) {
            // Prüfe ob es eine Funktions-Variable ist
            const declaration = node.declarationList.declarations[0];
            if (declaration && declaration.initializer) {
                if (ts.isArrowFunction(declaration.initializer) || 
                    ts.isFunctionExpression(declaration.initializer)) {
                    element = this.analyzeVariableFunction(node, sourceFile, code);
                }
            }
        }

        return element;
    }

    /**
     * Analysiert Funktions-Deklaration
     */
    private analyzeFunctionDeclaration(
        node: ts.FunctionDeclaration,
        sourceFile: ts.SourceFile,
        code: string
    ): CodeElement {
        const name = node.name?.getText() || 'anonymous';
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const line = lineAndChar.line + 1; // 1-basiert für VS Code

        return {
            type: 'function',
            name,
            line,
            complexity: this.calculateComplexity(node),
            hasComment: this.hasCommentBefore(node, sourceFile, code),
            parameters: this.extractParameters(node),
            returnType: node.type?.getText()
        };
    }

    /**
     * Analysiert Klassen-Deklaration
     */
    private analyzeClassDeclaration(
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile,
        code: string
    ): CodeElement {
        const name = node.name?.getText() || 'anonymous';
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const line = lineAndChar.line + 1;

        return {
            type: 'class',
            name,
            line,
            complexity: node.members.length,
            hasComment: this.hasCommentBefore(node, sourceFile, code),
            parameters: []
        };
    }

    /**
     * Analysiert Methoden-Deklaration
     */
    private analyzeMethodDeclaration(
        node: ts.MethodDeclaration,
        sourceFile: ts.SourceFile,
        code: string
    ): CodeElement {
        const name = node.name.getText();
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const line = lineAndChar.line + 1;

        return {
            type: 'method',
            name,
            line,
            complexity: this.calculateComplexity(node),
            hasComment: this.hasCommentBefore(node, sourceFile, code),
            parameters: this.extractParameters(node),
            returnType: node.type?.getText()
        };
    }

    /**
     * Analysiert Interface-Deklaration
     */
    private analyzeInterfaceDeclaration(
        node: ts.InterfaceDeclaration,
        sourceFile: ts.SourceFile,
        code: string
    ): CodeElement {
        const name = node.name.getText();
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const line = lineAndChar.line + 1;

        return {
            type: 'interface',
            name,
            line,
            complexity: node.members.length,
            hasComment: this.hasCommentBefore(node, sourceFile, code),
            parameters: []
        };
    }

    /**
     * Analysiert Funktions-Variable
     */
    private analyzeVariableFunction(
        node: ts.VariableStatement,
        sourceFile: ts.SourceFile,
        code: string
    ): CodeElement {
        const declaration = node.declarationList.declarations[0];
        const name = declaration.name.getText();
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const line = lineAndChar.line + 1;

        let parameters: Array<{ name: string; type?: string }> = [];
        let returnType: string | undefined;

        if (declaration.initializer) {
            if (ts.isArrowFunction(declaration.initializer) || 
                ts.isFunctionExpression(declaration.initializer)) {
                parameters = this.extractParameters(declaration.initializer);
                returnType = declaration.initializer.type?.getText();
            }
        }

        return {
            type: 'function',
            name,
            line,
            complexity: declaration.initializer ? 
                this.calculateComplexity(declaration.initializer) : 1,
            hasComment: this.hasCommentBefore(node, sourceFile, code),
            parameters,
            returnType
        };
    }

    /**
     * Extrahiert Parameter aus Funktion/Methode
     */
    private extractParameters(
        node: ts.FunctionDeclaration | ts.MethodDeclaration | 
              ts.ArrowFunction | ts.FunctionExpression
    ): Array<{ name: string; type?: string }> {
        return node.parameters.map(param => ({
            name: param.name.getText(),
            type: param.type?.getText()
        }));
    }

    /**
     * Berechnet Komplexität (vereinfacht - zählt Verzweigungen)
     */
    private calculateComplexity(node: ts.Node): number {
        let complexity = 1; // Base complexity

        const visit = (child: ts.Node) => {
            // Verzweigungen erhöhen Komplexität
            if (ts.isIfStatement(child)) complexity++;
            if (ts.isForStatement(child)) complexity++;
            if (ts.isWhileStatement(child)) complexity++;
            if (ts.isDoStatement(child)) complexity++;
            if (ts.isSwitchStatement(child)) complexity++;
            if (ts.isConditionalExpression(child)) complexity++;
            if (ts.isCaseClause(child)) complexity++;
            if (ts.isCatchClause(child)) complexity++;

            ts.forEachChild(child, visit);
        };

        ts.forEachChild(node, visit);
        return complexity;
    }

    /**
     * Prüft ob ein Kommentar vor dem Node existiert
     */
    private hasCommentBefore(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        code: string
    ): boolean {
        const start = node.getFullStart();
        const nodeStart = node.getStart();
        
        // Text zwischen Full-Start und Start enthält potentiell Kommentare
        const leadingText = code.substring(start, nodeStart);
        
        // Prüfe auf JSDoc oder Single-Line-Kommentare
        const hasJSDoc = /\/\*\*[\s\S]*?\*\//.test(leadingText);
        const hasMultiLine = /\/\*[\s\S]*?\*\//.test(leadingText);
        const hasSingleLine = /\/\/.*/.test(leadingText);
        
        return hasJSDoc || hasMultiLine || hasSingleLine;
    }

    /**
     * Statistiken über Code-Elemente
     */
    getStatistics(elements: CodeElement[]): CodeStatistics {
        const total = elements.length;
        const documented = elements.filter(e => e.hasComment).length;
        const undocumented = total - documented;
        
        const totalComplexity = elements.reduce((sum, e) => sum + e.complexity, 0);
        const avgComplexity = total > 0 ? totalComplexity / total : 0;
        
        const byType: { [key: string]: number } = {};
        elements.forEach(e => {
            byType[e.type] = (byType[e.type] || 0) + 1;
        });
        
        return {
            total,
            documented,
            undocumented,
            avgComplexity,
            byType
        };
    }

    /**
     * Findet undokumentierte Elemente
     */
    findUndocumented(elements: CodeElement[]): CodeElement[] {
        return elements.filter(e => !e.hasComment);
    }

    /**
     * Findet komplexe Funktionen
     */
    findComplexFunctions(elements: CodeElement[], minComplexity: number): CodeElement[] {
        return elements.filter(e => 
            (e.type === 'function' || e.type === 'method') && 
            e.complexity >= minComplexity
        );
    }
}
