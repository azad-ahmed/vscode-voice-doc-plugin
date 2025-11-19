import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Intelligenter Code-Struktur-Analyzer (Offline-fähig)
 * 
 * Analysiert Code-Struktur OHNE externe APIs durch:
 * 1. VS Code's Symbol-Provider (Language Server)
 * 2. Regex-basierte Pattern-Erkennung
 * 3. Intelligente Heuristiken
 * 
 * Funktioniert für: TypeScript, JavaScript, Python, Java, C#, Go, Rust, PHP
 */
export class OfflineCodeAnalyzer {

    /**
     * Analysiert Code-Struktur und findet optimale Kommentar-Position
     */
    static async analyzeCodeStructure(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<CodeStructureInfo> {
        try {
            ErrorHandler.log('OfflineAnalyzer', '🔍 Analysiere Code-Struktur (offline)...');

            // Methode 1: Nutze VS Code's Language Server (beste Qualität!)
            const symbolInfo = await this.getSymbolAtPosition(document, position);
            
            if (symbolInfo) {
                ErrorHandler.log('OfflineAnalyzer', `✅ Symbol gefunden: ${symbolInfo.name} (${symbolInfo.kind})`);
                return this.createStructureFromSymbol(symbolInfo, document, position);
            }

            // Methode 2: Fallback auf Regex-Analyse
            ErrorHandler.log('OfflineAnalyzer', '⚠️ Kein Symbol gefunden, nutze Regex-Analyse');
            return this.analyzeWithRegex(document, position);

        } catch (error: any) {
            ErrorHandler.handleError('OfflineAnalyzer.analyzeCodeStructure', error);
            
            // Fallback: Sichere Platzierung
            return {
                type: 'unknown',
                name: 'Unbekannt',
                startLine: position.line,
                insertLine: position.line,
                insertPosition: 'before',
                indentation: 0,
                confidence: 0.3
            };
        }
    }

    /**
     * Nutzt VS Code's Symbol-Provider (Language Server Integration)
     */
    private static async getSymbolAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<SymbolInfo | null> {
        try {
            // VS Code kann Symbole im Dokument finden
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (!symbols || symbols.length === 0) {
                return null;
            }

            // Finde Symbol an der aktuellen Position
            const symbol = this.findSymbolAtPosition(symbols, position);
            
            if (!symbol) {
                return null;
            }

            return {
                name: symbol.name,
                kind: this.symbolKindToString(symbol.kind),
                range: symbol.range,
                selectionRange: symbol.selectionRange
            };

        } catch (error) {
            ErrorHandler.log('OfflineAnalyzer', 'Symbol-Provider nicht verfügbar');
            return null;
        }
    }

    /**
     * Findet Symbol an bestimmter Position (rekursiv durch Baum)
     */
    private static findSymbolAtPosition(
        symbols: vscode.DocumentSymbol[],
        position: vscode.Position
    ): vscode.DocumentSymbol | null {
        for (const symbol of symbols) {
            // Prüfe ob Position innerhalb dieses Symbols
            if (symbol.range.contains(position)) {
                // Prüfe zuerst Kinder (spezifischer)
                if (symbol.children && symbol.children.length > 0) {
                    const child = this.findSymbolAtPosition(symbol.children, position);
                    if (child) {
                        return child;
                    }
                }
                // Wenn kein spezifischeres Kind, nutze dieses Symbol
                return symbol;
            }
        }
        return null;
    }

    /**
     * Konvertiert VS Code SymbolKind zu String
     */
    private static symbolKindToString(kind: vscode.SymbolKind): string {
        const mapping: { [key: number]: string } = {
            [vscode.SymbolKind.Function]: 'function',
            [vscode.SymbolKind.Method]: 'method',
            [vscode.SymbolKind.Class]: 'class',
            [vscode.SymbolKind.Interface]: 'interface',
            [vscode.SymbolKind.Constructor]: 'constructor',
            [vscode.SymbolKind.Property]: 'property',
            [vscode.SymbolKind.Variable]: 'variable',
            [vscode.SymbolKind.Constant]: 'constant',
            [vscode.SymbolKind.Enum]: 'enum',
            [vscode.SymbolKind.Struct]: 'struct'
        };
        return mapping[kind] || 'unknown';
    }

    /**
     * Erstellt CodeStructureInfo aus VS Code Symbol
     */
    private static createStructureFromSymbol(
        symbol: SymbolInfo,
        document: vscode.TextDocument,
        position: vscode.Position
    ): CodeStructureInfo {
        const startLine = symbol.range.start.line;
        const indentation = document.lineAt(startLine).firstNonWhitespaceCharacterIndex;

        return {
            type: symbol.kind,
            name: symbol.name,
            startLine: startLine,
            insertLine: startLine,
            insertPosition: 'before',
            indentation: indentation,
            confidence: 0.95, // Sehr hohe Konfidenz bei Symbol-Provider
            details: {
                range: symbol.range,
                selectionRange: symbol.selectionRange
            }
        };
    }

    /**
     * Regex-basierte Analyse als Fallback
     */
    private static analyzeWithRegex(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CodeStructureInfo {
        const languageId = document.languageId;
        const currentLine = position.line;
        
        // Suche nach Funktionen/Klassen in der Nähe (±10 Zeilen)
        const searchStart = Math.max(0, currentLine - 10);
        const searchEnd = Math.min(document.lineCount - 1, currentLine + 10);

        let bestMatch: CodeStructureInfo | null = null;
        let minDistance = Infinity;

        for (let i = searchStart; i <= searchEnd; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            
            // Prüfe verschiedene Pattern
            const matches = this.matchCodePatterns(lineText, languageId);
            
            for (const match of matches) {
                const distance = Math.abs(i - currentLine);
                
                // Wähle nächstes Match
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        type: match.type,
                        name: match.name,
                        startLine: i,
                        insertLine: i,
                        insertPosition: 'before',
                        indentation: line.firstNonWhitespaceCharacterIndex,
                        confidence: 0.7 - (distance * 0.05) // Konfidenz sinkt mit Distanz
                    };
                }
            }
        }

        // Fallback: Aktuelle Position
        if (!bestMatch) {
            const line = document.lineAt(currentLine);
            bestMatch = {
                type: 'unknown',
                name: 'Code',
                startLine: currentLine,
                insertLine: currentLine,
                insertPosition: 'before',
                indentation: line.firstNonWhitespaceCharacterIndex,
                confidence: 0.5
            };
        }

        return bestMatch;
    }

    /**
     * Pattern-Matching für verschiedene Sprachen
     */
    private static matchCodePatterns(
        line: string,
        languageId: string
    ): Array<{ type: string, name: string }> {
        const patterns = this.getLanguagePatterns(languageId);
        const matches: Array<{ type: string, name: string }> = [];

        for (const [type, pattern] of Object.entries(patterns)) {
            const match = line.match(pattern.regex);
            if (match) {
                const name = match[pattern.nameGroup] || 'unnamed';
                matches.push({ type, name });
            }
        }

        return matches;
    }

    /**
     * Sprachspezifische Patterns
     */
    private static getLanguagePatterns(languageId: string): LanguagePatterns {
        const patterns: { [key: string]: LanguagePatterns } = {
            'typescript': {
                'function': {
                    regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
                    nameGroup: 1
                },
                'class': {
                    regex: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
                    nameGroup: 1
                },
                'interface': {
                    regex: /(?:export\s+)?interface\s+(\w+)/,
                    nameGroup: 1
                },
                'method': {
                    regex: /^\s+(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/,
                    nameGroup: 1
                }
            },
            'javascript': {
                'function': {
                    regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
                    nameGroup: 1
                },
                'class': {
                    regex: /(?:export\s+)?class\s+(\w+)/,
                    nameGroup: 1
                },
                'arrow_function': {
                    regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
                    nameGroup: 1
                }
            },
            'python': {
                'function': {
                    regex: /^(?:async\s+)?def\s+(\w+)\s*\(/,
                    nameGroup: 1
                },
                'class': {
                    regex: /^class\s+(\w+)/,
                    nameGroup: 1
                },
                'method': {
                    regex: /^\s+(?:async\s+)?def\s+(\w+)\s*\(/,
                    nameGroup: 1
                }
            },
            'java': {
                'class': {
                    regex: /(?:public|private)?\s*(?:abstract\s+)?class\s+(\w+)/,
                    nameGroup: 1
                },
                'method': {
                    regex: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/,
                    nameGroup: 1
                },
                'interface': {
                    regex: /(?:public\s+)?interface\s+(\w+)/,
                    nameGroup: 1
                }
            },
            'csharp': {
                'class': {
                    regex: /(?:public|private|internal)?\s*(?:abstract\s+)?class\s+(\w+)/,
                    nameGroup: 1
                },
                'method': {
                    regex: /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(?:\w+\s+)+(\w+)\s*\(/,
                    nameGroup: 1
                },
                'interface': {
                    regex: /(?:public\s+)?interface\s+(\w+)/,
                    nameGroup: 1
                }
            },
            'go': {
                'function': {
                    regex: /^func\s+(\w+)\s*\(/,
                    nameGroup: 1
                },
                'method': {
                    regex: /^func\s+\(\w+\s+\*?\w+\)\s+(\w+)\s*\(/,
                    nameGroup: 1
                },
                'struct': {
                    regex: /^type\s+(\w+)\s+struct/,
                    nameGroup: 1
                }
            },
            'rust': {
                'function': {
                    regex: /(?:pub\s+)?fn\s+(\w+)/,
                    nameGroup: 1
                },
                'struct': {
                    regex: /(?:pub\s+)?struct\s+(\w+)/,
                    nameGroup: 1
                },
                'impl': {
                    regex: /impl\s+(\w+)/,
                    nameGroup: 1
                }
            },
            'php': {
                'function': {
                    regex: /function\s+(\w+)\s*\(/,
                    nameGroup: 1
                },
                'class': {
                    regex: /class\s+(\w+)/,
                    nameGroup: 1
                },
                'method': {
                    regex: /(?:public|private|protected)\s+function\s+(\w+)\s*\(/,
                    nameGroup: 1
                }
            }
        };

        return patterns[languageId] || patterns['javascript'];
    }

    /**
     * Analysiert Code-Block-Struktur (verschachtelte Blöcke)
     */
    static analyzeBlockStructure(
        document: vscode.TextDocument,
        startLine: number,
        endLine: number
    ): BlockStructure {
        const blocks: CodeBlock[] = [];
        let currentIndent = 0;
        let blockStack: CodeBlock[] = [];

        for (let i = startLine; i <= Math.min(endLine, document.lineCount - 1); i++) {
            const line = document.lineAt(i);
            const text = line.text;
            const indent = line.firstNonWhitespaceCharacterIndex;

            // Ignoriere leere Zeilen und Kommentare
            if (text.trim().length === 0 || this.isCommentLine(text)) {
                continue;
            }

            // Block beginnt
            if (text.includes('{')) {
                const block: CodeBlock = {
                    startLine: i,
                    endLine: -1, // Noch unbekannt
                    indentation: indent,
                    type: this.detectBlockType(text, document.languageId)
                };
                blockStack.push(block);
            }

            // Block endet
            if (text.includes('}')) {
                if (blockStack.length > 0) {
                    const block = blockStack.pop()!;
                    block.endLine = i;
                    blocks.push(block);
                }
            }
        }

        // Schließe offene Blöcke
        for (const block of blockStack) {
            block.endLine = endLine;
            blocks.push(block);
        }

        return {
            blocks: blocks,
            depth: blockStack.length,
            hasNestedBlocks: blocks.some(b => b.indentation > 0)
        };
    }

    /**
     * Prüft ob Zeile ein Kommentar ist
     */
    private static isCommentLine(line: string): boolean {
        const trimmed = line.trim();
        return (
            trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('"""') ||
            trimmed.startsWith("'''")
        );
    }

    /**
     * Erkennt Block-Typ
     */
    private static detectBlockType(line: string, languageId: string): string {
        if (line.match(/class\s+/)) return 'class';
        if (line.match(/function\s+|def\s+|fn\s+/)) return 'function';
        if (line.match(/if\s*\(/)) return 'if';
        if (line.match(/for\s*\(/)) return 'for';
        if (line.match(/while\s*\(/)) return 'while';
        if (line.match(/try\s*{/)) return 'try';
        return 'block';
    }
}

/**
 * Symbol-Information von VS Code
 */
interface SymbolInfo {
    name: string;
    kind: string;
    range: vscode.Range;
    selectionRange: vscode.Range;
}

/**
 * Code-Struktur-Information
 */
export interface CodeStructureInfo {
    type: string;              // function, class, method, etc.
    name: string;              // Name des Elements
    startLine: number;         // Zeile wo Element beginnt
    insertLine: number;        // Wo Kommentar hin soll
    insertPosition: 'before' | 'after'; // Vor oder nach
    indentation: number;       // Einrückung
    confidence: number;        // Konfidenz (0-1)
    details?: any;             // Zusätzliche Details
}

/**
 * Language Pattern Definition
 */
interface LanguagePatterns {
    [key: string]: {
        regex: RegExp;
        nameGroup: number;
    };
}

/**
 * Code-Block Information
 */
interface CodeBlock {
    startLine: number;
    endLine: number;
    indentation: number;
    type: string;
}

/**
 * Block-Struktur
 */
interface BlockStructure {
    blocks: CodeBlock[];
    depth: number;
    hasNestedBlocks: boolean;
}
