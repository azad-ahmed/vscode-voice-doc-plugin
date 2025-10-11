import * as vscode from 'vscode';
import * as ts from 'typescript';

/**
 * Analysiert TypeScript/JavaScript Code und extrahiert Funktionen, Klassen und Methoden
 */
export class CodeAnalyzer {
    
    /**
     * Analysiert ein Dokument und findet alle dokumentationswürdigen Code-Elemente
     */
    public analyzeDocument(document: vscode.TextDocument): CodeElement[] {
        const elements: CodeElement[] = [];
        const sourceFile = ts.createSourceFile(
            document.fileName,
            document.getText(),
            ts.ScriptTarget.Latest,
            true
        );

        this.visitNode(sourceFile, elements, document);
        return elements;
    }

    /**
     * Besucht einen AST-Node rekursiv
     */
    private visitNode(node: ts.Node, elements: CodeElement[], document: vscode.TextDocument): void {
        if (ts.isFunctionDeclaration(node) && node.name) {
            elements.push(this.extractFunction(node, document));
        } else if (ts.isClassDeclaration(node) && node.name) {
            elements.push(this.extractClass(node, document));
        } else if (ts.isMethodDeclaration(node) && node.name) {
            elements.push(this.extractMethod(node, document));
        } else if (ts.isArrowFunction(node)) {
            elements.push(this.extractArrowFunction(node, document));
        }

        ts.forEachChild(node, child => this.visitNode(child, elements, document));
    }

    /**
     * Extrahiert Informationen aus einer Funktionsdeklaration
     */
    private extractFunction(node: ts.FunctionDeclaration, document: vscode.TextDocument): CodeElement {
        const position = document.positionAt(node.getStart());
        const name = node.name?.getText() || 'anonymous';
        const parameters = this.extractParameters(node);
        const returnType = this.extractReturnType(node);
        const body = this.extractFunctionBody(node);

        return {
            type: 'function',
            name,
            position,
            line: position.line,
            parameters,
            returnType,
            body,
            hasComment: this.hasExistingComment(document, position.line),
            signature: this.buildSignature(name, parameters, returnType),
            complexity: this.calculateComplexity(node)
        };
    }

    /**
     * Extrahiert Informationen aus einer Klassendeklaration
     */
    private extractClass(node: ts.ClassDeclaration, document: vscode.TextDocument): CodeElement {
        const position = document.positionAt(node.getStart());
        const name = node.name?.getText() || 'AnonymousClass';
        const methods = this.extractClassMethods(node);
        const properties = this.extractClassProperties(node);

        return {
            type: 'class',
            name,
            position,
            line: position.line,
            methods,
            properties,
            hasComment: this.hasExistingComment(document, position.line),
            signature: `class ${name}`,
            complexity: this.calculateComplexity(node)
        };
    }

    /**
     * Extrahiert Informationen aus einer Methodendeklaration
     */
    private extractMethod(node: ts.MethodDeclaration, document: vscode.TextDocument): CodeElement {
        const position = document.positionAt(node.getStart());
        const name = node.name?.getText() || 'anonymous';
        const parameters = this.extractParameters(node);
        const returnType = this.extractReturnType(node);
        const body = this.extractFunctionBody(node);
        const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

        return {
            type: 'method',
            name,
            position,
            line: position.line,
            parameters,
            returnType,
            body,
            isAsync,
            hasComment: this.hasExistingComment(document, position.line),
            signature: this.buildSignature(name, parameters, returnType),
            complexity: this.calculateComplexity(node)
        };
    }

    /**
     * Extrahiert Informationen aus einer Arrow-Funktion
     */
    private extractArrowFunction(node: ts.ArrowFunction, document: vscode.TextDocument): CodeElement {
        const position = document.positionAt(node.getStart());
        const parameters = this.extractParameters(node);
        const body = this.extractFunctionBody(node);

        return {
            type: 'arrow-function',
            name: 'arrow function',
            position,
            line: position.line,
            parameters,
            body,
            hasComment: this.hasExistingComment(document, position.line),
            signature: 'arrow function',
            complexity: this.calculateComplexity(node)
        };
    }

    /**
     * Extrahiert Parameter aus einer Funktion/Methode
     */
    private extractParameters(node: ts.FunctionLikeDeclaration): ParameterInfo[] {
        return node.parameters.map(param => ({
            name: param.name.getText(),
            type: param.type?.getText() || 'any',
            isOptional: !!param.questionToken,
            defaultValue: param.initializer?.getText()
        }));
    }

    /**
     * Extrahiert den Rückgabetyp
     */
    private extractReturnType(node: ts.FunctionLikeDeclaration): string {
        return node.type?.getText() || 'void';
    }

    /**
     * Extrahiert den Funktionskörper als Text
     */
    private extractFunctionBody(node: ts.FunctionLikeDeclaration): string {
        if (node.body) {
            return node.body.getText().substring(0, 500);
        }
        return '';
    }

    /**
     * Extrahiert Methoden aus einer Klasse
     */
    private extractClassMethods(node: ts.ClassDeclaration): string[] {
        const methods: string[] = [];
        node.members.forEach(member => {
            if (ts.isMethodDeclaration(member) && member.name) {
                methods.push(member.name.getText());
            }
        });
        return methods;
    }

    /**
     * Extrahiert Properties aus einer Klasse
     */
    private extractClassProperties(node: ts.ClassDeclaration): string[] {
        const properties: string[] = [];
        node.members.forEach(member => {
            if (ts.isPropertyDeclaration(member) && member.name) {
                properties.push(member.name.getText());
            }
        });
        return properties;
    }

    /**
     * Prüft ob bereits ein Kommentar vorhanden ist
     */
    private hasExistingComment(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;
        
        const previousLine = document.lineAt(Math.max(0, line - 1)).text.trim();
        return previousLine.startsWith('//') || 
               previousLine.startsWith('/*') || 
               previousLine.startsWith('*') ||
               previousLine.startsWith('/**');
    }

    /**
     * Erstellt eine Signatur-String
     */
    private buildSignature(name: string, parameters: ParameterInfo[], returnType: string): string {
        const params = parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        return `${name}(${params}): ${returnType}`;
    }

    /**
     * Berechnet die zyklomatische Komplexität
     */
    private calculateComplexity(node: ts.Node): number {
        let complexity = 1;

        const visit = (n: ts.Node) => {
            if (ts.isIfStatement(n) || 
                ts.isWhileStatement(n) || 
                ts.isForStatement(n) ||
                ts.isConditionalExpression(n) ||
                ts.isCaseClause(n)) {
                complexity++;
            }
            ts.forEachChild(n, visit);
        };

        visit(node);
        return complexity;
    }

    /**
     * Generiert eine Code-Beschreibung für KI-Analyse
     */
    public generateCodeDescription(element: CodeElement): string {
        const parts: string[] = [];

        parts.push(`Type: ${element.type}`);
        parts.push(`Name: ${element.name}`);
        parts.push(`Signature: ${element.signature}`);

        if (element.parameters && element.parameters.length > 0) {
            parts.push(`Parameters: ${element.parameters.map(p => p.name).join(', ')}`);
        }

        if (element.returnType && element.returnType !== 'void') {
            parts.push(`Returns: ${element.returnType}`);
        }

        if (element.complexity && element.complexity > 1) {
            parts.push(`Complexity: ${element.complexity}`);
        }

        if (element.body) {
            parts.push(`Code snippet:\n${element.body}`);
        }

        return parts.join('\n');
    }
}

/**
 * Informationen über ein Code-Element
 */
export interface CodeElement {
    type: 'function' | 'class' | 'method' | 'arrow-function';
    name: string;
    position: vscode.Position;
    line: number;
    parameters?: ParameterInfo[];
    returnType?: string;
    body?: string;
    methods?: string[];
    properties?: string[];
    isAsync?: boolean;
    hasComment: boolean;
    signature: string;
    complexity: number;
}

/**
 * Informationen über einen Parameter
 */
export interface ParameterInfo {
    name: string;
    type: string;
    isOptional: boolean;
    defaultValue?: string;
}
