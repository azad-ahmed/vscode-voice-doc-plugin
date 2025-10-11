import * as vscode from 'vscode';

/**
 * Repräsentiert einen erkannten Code-Block der dokumentiert werden sollte
 */
export interface CodeBlock {
    type: 'function' | 'class' | 'method' | 'interface' | 'const' | 'variable';
    name: string;
    range: vscode.Range;
    code: string;
    hasDocumentation: boolean;
    signature?: string;
    parameters?: string[];
    returnType?: string;
}

/**
 * Parser für verschiedene Programmiersprachen
 * Erkennt Funktionen, Klassen, Methoden etc.
 */
export class CodeParser {
    
    static parseDocument(document: vscode.TextDocument): CodeBlock[] {
        const languageId = document.languageId;
        
        switch (languageId) {
            case 'typescript':
            case 'javascript':
            case 'typescriptreact':
            case 'javascriptreact':
                return this.parseJavaScriptLike(document);
            
            case 'python':
                return this.parsePython(document);
            
            case 'java':
            case 'csharp':
                return this.parseJavaLike(document);
            
            default:
                return this.parseGeneric(document);
        }
    }
    
    private static parseJavaScriptLike(document: vscode.TextDocument): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Regex-Patterns für verschiedene Konstrukte
        const patterns = {
            function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/,
            arrowFunction: /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>{]+))?\s*=>/,
            method: /^\s*(?:public|private|protected|static|async)?\s*(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/,
            class: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/,
            interface: /^\s*(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/,
            const: /^\s*(?:export\s+)?const\s+(\w+)\s*(?::\s*([^=]+))?\s*=/,
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Prüfe ob vorherige Zeile bereits Dokumentation hat
            const hasDoc = i > 0 && (
                lines[i - 1].trim().startsWith('//') ||
                lines[i - 1].trim().startsWith('/*') ||
                lines[i - 1].trim().startsWith('*')
            );
            
            // Function
            let match = patterns.function.exec(line);
            if (match) {
                blocks.push({
                    type: 'function',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim(),
                    parameters: match[2] ? match[2].split(',').map(p => p.trim().split(':')[0]) : [],
                    returnType: match[3]?.trim()
                });
                continue;
            }
            
            // Arrow Function
            match = patterns.arrowFunction.exec(line);
            if (match) {
                blocks.push({
                    type: 'const',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim(),
                    parameters: match[2] ? match[2].split(',').map(p => p.trim().split(':')[0]) : [],
                    returnType: match[3]?.trim()
                });
                continue;
            }
            
            // Class
            match = patterns.class.exec(line);
            if (match) {
                blocks.push({
                    type: 'class',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim()
                });
                continue;
            }
            
            // Interface
            match = patterns.interface.exec(line);
            if (match) {
                blocks.push({
                    type: 'interface',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim()
                });
                continue;
            }
        }
        
        return blocks;
    }
    
    private static parsePython(document: vscode.TextDocument): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        const patterns = {
            function: /^\s*def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/,
            class: /^\s*class\s+(\w+)(?:\([^)]*\))?\s*:/,
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            const hasDoc = i > 0 && (
                lines[i - 1].trim().startsWith('#') ||
                lines[i - 1].trim().startsWith('"""') ||
                lines[i - 1].trim().startsWith("'''")
            );
            
            let match = patterns.function.exec(line);
            if (match) {
                blocks.push({
                    type: 'function',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim(),
                    parameters: match[2] ? match[2].split(',').map(p => p.trim().split(':')[0]) : [],
                    returnType: match[3]?.trim()
                });
                continue;
            }
            
            match = patterns.class.exec(line);
            if (match) {
                blocks.push({
                    type: 'class',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim()
                });
            }
        }
        
        return blocks;
    }
    
    private static parseJavaLike(document: vscode.TextDocument): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        const patterns = {
            method: /^\s*(?:public|private|protected|static|final|abstract)*\s*(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/,
            class: /^\s*(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/,
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            const hasDoc = i > 0 && (
                lines[i - 1].trim().startsWith('//') ||
                lines[i - 1].trim().startsWith('/*') ||
                lines[i - 1].trim().startsWith('*')
            );
            
            let match = patterns.method.exec(line);
            if (match) {
                blocks.push({
                    type: 'method',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim(),
                    parameters: match[2] ? match[2].split(',').map(p => p.trim().split(/\s+/)[1] || p.trim()) : []
                });
                continue;
            }
            
            match = patterns.class.exec(line);
            if (match) {
                blocks.push({
                    type: 'class',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim()
                });
            }
        }
        
        return blocks;
    }
    
    private static parseGeneric(document: vscode.TextDocument): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        const functionPattern = /^\s*(?:function|def|func|fn|sub|proc)\s+(\w+)/;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = functionPattern.exec(line);
            
            if (match) {
                const hasDoc = i > 0 && (
                    lines[i - 1].trim().startsWith('//') ||
                    lines[i - 1].trim().startsWith('#') ||
                    lines[i - 1].trim().startsWith('/*')
                );
                
                blocks.push({
                    type: 'function',
                    name: match[1],
                    range: new vscode.Range(i, 0, i, line.length),
                    code: line.trim(),
                    hasDocumentation: hasDoc,
                    signature: line.trim()
                });
            }
        }
        
        return blocks;
    }
    
    static getUndocumentedBlocks(document: vscode.TextDocument): CodeBlock[] {
        const allBlocks = this.parseDocument(document);
        return allBlocks.filter(block => !block.hasDocumentation);
    }
}
