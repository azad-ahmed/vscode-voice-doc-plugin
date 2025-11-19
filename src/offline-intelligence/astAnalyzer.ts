import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * AST-basierter Code-Struktur-Analyzer für TypeScript/JavaScript
 * 
 * Analysiert Code OHNE externe API - komplett offline!
 * Nutzt TypeScript Compiler API für präzise Struktur-Erkennung
 */
export class ASTCodeAnalyzer {

    /**
     * Analysiert Code-Struktur an gegebener Position
     */
    static analyzeCodeAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CodeStructure | null {
        try {
            const sourceCode = document.getText();
            const offset = document.offsetAt(position);

            // Erstelle SourceFile mit TypeScript Compiler API
            const sourceFile = ts.createSourceFile(
                document.fileName,
                sourceCode,
                ts.ScriptTarget.Latest,
                true
            );

            // Finde Node an Cursor-Position
            const node = this.findNodeAtPosition(sourceFile, offset);
            
            if (!node) {
                ErrorHandler.log('ASTAnalyzer', 'Kein Node an Position gefunden');
                return null;
            }

            // Analysiere Node-Typ und Kontext
            const structure = this.analyzeNode(node, sourceFile);

            ErrorHandler.log('ASTAnalyzer', `Gefunden: ${structure.type} "${structure.name}"`, 'success');
            
            return structure;

        } catch (error: any) {
            ErrorHandler.handleError('ASTAnalyzer.analyzeCodeAtPosition', error);
            return null;
        }
    }

    /**
     * Findet AST-Node an gegebener Position
     */
    private static findNodeAtPosition(
        sourceFile: ts.SourceFile,
        position: number
    ): ts.Node | undefined {
        let foundNode: ts.Node | undefined;

        const visit = (node: ts.Node) => {
            if (position >= node.getStart() && position <= node.getEnd()) {
                foundNode = node;
                ts.forEachChild(node, visit);
            }
        };

        visit(sourceFile);
        return foundNode;
    }

    /**
     * Analysiert Node und extrahiert Struktur-Informationen
     */
    private static analyzeNode(
        node: ts.Node,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        // Suche nach dem übergeordneten relevanten Node
        let current: ts.Node | undefined = node;
        
        while (current) {
            if (ts.isFunctionDeclaration(current)) {
                return this.analyzeFunctionDeclaration(current, sourceFile);
            }
            if (ts.isClassDeclaration(current)) {
                return this.analyzeClassDeclaration(current, sourceFile);
            }
            if (ts.isMethodDeclaration(current)) {
                return this.analyzeMethodDeclaration(current, sourceFile);
            }
            if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
                return this.analyzeArrowFunction(current, sourceFile);
            }
            if (ts.isInterfaceDeclaration(current)) {
                return this.analyzeInterfaceDeclaration(current, sourceFile);
            }
            if (ts.isVariableDeclaration(current)) {
                return this.analyzeVariableDeclaration(current, sourceFile);
            }
            
            current = current.parent;
        }

        // Fallback: Generische Code-Block-Analyse
        return {
            type: 'unknown',
            name: 'code',
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line,
            indentation: this.getIndentation(node, sourceFile),
            parameters: [],
            returnType: undefined,
            scope: 'unknown',
            complexity: 1
        };
    }

    /**
     * Analysiert Funktions-Deklaration
     */
    private static analyzeFunctionDeclaration(
        node: ts.FunctionDeclaration,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        const name = node.name?.getText() || 'anonymous';
        const parameters = this.extractParameters(node);
        const returnType = this.extractReturnType(node);
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const indentation = this.getIndentation(node, sourceFile);
        const complexity = this.calculateComplexity(node);
        const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
        const isExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

        return {
            type: 'function',
            name,
            line,
            indentation,
            parameters,
            returnType,
            scope: isExport ? 'export' : 'local',
            complexity,
            isAsync
        };
    }

    /**
     * Analysiert Klassen-Deklaration
     */
    private static analyzeClassDeclaration(
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        const name = node.name?.getText() || 'anonymous';
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const indentation = this.getIndentation(node, sourceFile);
        const isExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
        const isAbstract = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword) || false;

        // Extrahiere Methoden und Properties
        const methods: string[] = [];
        const properties: string[] = [];

        node.members.forEach(member => {
            if (ts.isMethodDeclaration(member) && member.name) {
                methods.push(member.name.getText());
            }
            if (ts.isPropertyDeclaration(member) && member.name) {
                properties.push(member.name.getText());
            }
        });

        return {
            type: 'class',
            name,
            line,
            indentation,
            parameters: [],
            returnType: undefined,
            scope: isExport ? 'export' : 'local',
            complexity: methods.length + properties.length,
            isAbstract,
            methods,
            properties
        };
    }

    /**
     * Analysiert Methoden-Deklaration
     */
    private static analyzeMethodDeclaration(
        node: ts.MethodDeclaration,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        const name = node.name.getText();
        const parameters = this.extractParameters(node);
        const returnType = this.extractReturnType(node);
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const indentation = this.getIndentation(node, sourceFile);
        const complexity = this.calculateComplexity(node);
        
        const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
        const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || false;
        const visibility = this.getVisibility(node);

        // Finde Klassen-Kontext
        let className = 'unknown';
        let current = node.parent;
        while (current) {
            if (ts.isClassDeclaration(current) && current.name) {
                className = current.name.getText();
                break;
            }
            current = current.parent;
        }

        return {
            type: 'method',
            name,
            line,
            indentation,
            parameters,
            returnType,
            scope: visibility,
            complexity,
            isAsync,
            isStatic,
            className
        };
    }

    /**
     * Analysiert Arrow-Function oder Function-Expression
     */
    private static analyzeArrowFunction(
        node: ts.ArrowFunction | ts.FunctionExpression,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        const parameters = this.extractParameters(node);
        const returnType = this.extractReturnType(node);
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const indentation = this.getIndentation(node, sourceFile);
        const complexity = this.calculateComplexity(node);
        const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

        // Versuche Namen aus Variable-Declaration zu extrahieren
        let name = 'anonymous';
        if (node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name) {
            name = node.parent.name.getText();
        }

        return {
            type: 'arrow-function',
            name,
            line,
            indentation,
            parameters,
            returnType,
            scope: 'local',
            complexity,
            isAsync
        };
    }

    /**
     * Analysiert Interface-Deklaration
     */
    private static analyzeInterfaceDeclaration(
        node: ts.InterfaceDeclaration,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        const name = node.name.getText();
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const indentation = this.getIndentation(node, sourceFile);
        const isExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

        return {
            type: 'interface',
            name,
            line,
            indentation,
            parameters: [],
            returnType: undefined,
            scope: isExport ? 'export' : 'local',
            complexity: node.members.length
        };
    }

    /**
     * Analysiert Variable-Declaration
     */
    private static analyzeVariableDeclaration(
        node: ts.VariableDeclaration,
        sourceFile: ts.SourceFile
    ): CodeStructure {
        const name = node.name.getText();
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const indentation = this.getIndentation(node, sourceFile);
        
        // Prüfe ob es eine Funktion ist
        const isFunctionVariable = node.initializer && (
            ts.isArrowFunction(node.initializer) || 
            ts.isFunctionExpression(node.initializer)
        );

        return {
            type: isFunctionVariable ? 'function-variable' : 'variable',
            name,
            line,
            indentation,
            parameters: [],
            returnType: undefined,
            scope: 'local',
            complexity: 1
        };
    }

    /**
     * Extrahiert Parameter aus Funktion/Methode
     */
    private static extractParameters(
        node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression
    ): FunctionParameter[] {
        return node.parameters.map(param => ({
            name: param.name.getText(),
            type: param.type ? param.type.getText() : 'any',
            optional: !!param.questionToken,
            defaultValue: param.initializer ? param.initializer.getText() : undefined
        }));
    }

    /**
     * Extrahiert Return-Type
     */
    private static extractReturnType(
        node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression
    ): string | undefined {
        return node.type ? node.type.getText() : undefined;
    }

    /**
     * Berechnet Komplexität (vereinfacht)
     */
    private static calculateComplexity(node: ts.Node): number {
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
     * Ermittelt Einrückung
     */
    private static getIndentation(node: ts.Node, sourceFile: ts.SourceFile): number {
        const start = node.getStart();
        const lineStart = sourceFile.getLineAndCharacterOfPosition(start);
        return lineStart.character;
    }

    /**
     * Ermittelt Sichtbarkeit (public/private/protected)
     */
    private static getVisibility(node: ts.MethodDeclaration): string {
        if (node.modifiers) {
            for (const modifier of node.modifiers) {
                if (modifier.kind === ts.SyntaxKind.PublicKeyword) return 'public';
                if (modifier.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
                if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
            }
        }
        return 'public'; // Default in TypeScript
    }

    /**
     * Findet beste Position für Kommentar
     */
    static findCommentPosition(structure: CodeStructure): CommentPosition {
        // Kommentare kommen immer VOR die Deklaration
        return {
            line: structure.line,
            position: 'before',
            indentation: structure.indentation
        };
    }
}

/**
 * Code-Struktur Information
 */
export interface CodeStructure {
    type: 'function' | 'class' | 'method' | 'arrow-function' | 'interface' | 'variable' | 'function-variable' | 'unknown';
    name: string;
    line: number;
    indentation: number;
    parameters: FunctionParameter[];
    returnType?: string;
    scope: string;
    complexity: number;
    isAsync?: boolean;
    isStatic?: boolean;
    isAbstract?: boolean;
    className?: string;
    methods?: string[];
    properties?: string[];
}

/**
 * Funktions-Parameter
 */
export interface FunctionParameter {
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
}

/**
 * Kommentar-Position
 */
export interface CommentPosition {
    line: number;
    position: 'before' | 'after';
    indentation: number;
}
