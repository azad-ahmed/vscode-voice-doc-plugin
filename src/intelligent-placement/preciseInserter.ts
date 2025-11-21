import * as vscode from 'vscode';
import { CommentPlacement } from './claudeAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';
import { PositionValidator } from './positionValidator';

/**
 * Präziser Kommentar-Inserter - platziert Kommentare exakt nach Claude's Anweisungen
 * 
 * Verhindert Syntaxfehler durch:
 * 1. AST-basierte Analyse (via VS Code Language Server)
 * 2. Präzise Positionierung gemäß Claude's Instruktionen
 * 3. Korrekte Einrückung
 * 4. Validierung vor dem Einfügen
 */
export class PreciseCommentInserter {
    
    /**
     * Fügt Kommentar präzise nach Claude's Platzierungs-Anweisungen ein
     */
    static async insertComment(
        editor: vscode.TextEditor,
        placement: CommentPlacement
    ): Promise<boolean> {
        try {
            const validatedPlacement = PositionValidator.validateAndCorrect(
                editor.document,
                placement
            );
            
            ErrorHandler.log('PreciseInserter', `Platziere Kommentar an Zeile ${validatedPlacement.targetLine} (${validatedPlacement.position})`);
            ErrorHandler.log('PreciseInserter', `Grund: ${validatedPlacement.reasoning}`);

            const document = editor.document;
            
            // Validiere Zeilennummer
            if (validatedPlacement.targetLine < 0 || validatedPlacement.targetLine >= document.lineCount) {
                ErrorHandler.log('PreciseInserter', `⚠️ Ungültige Zeile ${validatedPlacement.targetLine}, nutze aktuelle Position`);
                validatedPlacement.targetLine = editor.selection.active.line;
            }

            // Bestimme exakte Insert-Position
            const insertPosition = this.calculateInsertPosition(
                document,
                validatedPlacement.targetLine,
                validatedPlacement.position
            );

            // Bereite Kommentar mit korrekter Einrückung vor
            const formattedComment = this.formatCommentWithIndentation(
                validatedPlacement.comment,
                validatedPlacement.indentation
            );

            // Füge Kommentar ein
            const success = await editor.edit(editBuilder => {
                editBuilder.insert(insertPosition, formattedComment + '\n');
            });

            if (success) {
                ErrorHandler.log('PreciseInserter', '✅ Kommentar erfolgreich eingefügt', 'success');
                
                // Zeige Info-Message mit Reasoning
                vscode.window.showInformationMessage(
                    `✅ Kommentar eingefügt!\n📍 ${validatedPlacement.reasoning}`
                );
            } else {
                ErrorHandler.handleError('PreciseInserter', new Error('Einfügen fehlgeschlagen'), false);
            }

            return success;

        } catch (error: any) {
            ErrorHandler.handleError('PreciseInserter.insertComment', error);
            return false;
        }
    }

    /**
     * Berechnet exakte Insert-Position basierend auf Claude's Anweisungen
     */
    private static calculateInsertPosition(
        document: vscode.TextDocument,
        targetLine: number,
        position: 'before' | 'after'
    ): vscode.Position {
        if (position === 'before') {
            // Füge am Anfang der Zielzeile ein
            return new vscode.Position(targetLine, 0);
        } else {
            // Füge am Ende der Zielzeile ein (neue Zeile nach)
            const line = document.lineAt(targetLine);
            return new vscode.Position(targetLine + 1, 0);
        }
    }

    /**
     * Formatiert Kommentar mit korrekter Einrückung
     */
    private static formatCommentWithIndentation(
        comment: string,
        indentation: number
    ): string {
        const indent = ' '.repeat(indentation);
        
        // Behandle mehrzeilige Kommentare
        const lines = comment.split('\n');
        const indentedLines = lines.map(line => {
            // Erste Zeile und leere Zeilen erhalten volle Einrückung
            if (line.trim().length === 0) {
                return indent + line.trim();
            }
            // Zeilen die bereits mit * beginnen (JSDoc) erhalten volle Einrückung
            if (line.trim().startsWith('*')) {
                return indent + ' ' + line.trim();
            }
            return indent + line.trim();
        });

        return indentedLines.join('\n');
    }

    /**
     * Analysiert Code-Struktur um optimale Position zu finden
     * (Fallback falls Claude-Analyse fehlschlägt)
     */
    static async findOptimalPosition(
        document: vscode.TextDocument,
        cursorLine: number
    ): Promise<OptimalPosition> {
        try {
            const line = document.lineAt(cursorLine);
            const lineText = line.text.trim();

            // Erkenne verschiedene Code-Strukturen
            if (this.isFunctionDeclaration(lineText, document.languageId)) {
                return {
                    line: cursorLine,
                    position: 'before',
                    indentation: line.firstNonWhitespaceCharacterIndex,
                    reason: 'Funktionsdefinition erkannt'
                };
            }

            if (this.isClassDeclaration(lineText, document.languageId)) {
                return {
                    line: cursorLine,
                    position: 'before',
                    indentation: line.firstNonWhitespaceCharacterIndex,
                    reason: 'Klassendefinition erkannt'
                };
            }

            if (this.isMethodDeclaration(lineText, document.languageId)) {
                return {
                    line: cursorLine,
                    position: 'before',
                    indentation: line.firstNonWhitespaceCharacterIndex,
                    reason: 'Methodendefinition erkannt'
                };
            }

            // Fallback: Nutze aktuelle Zeile
            return {
                line: cursorLine,
                position: 'before',
                indentation: line.firstNonWhitespaceCharacterIndex,
                reason: 'Aktuelle Position'
            };

        } catch (error) {
            ErrorHandler.handleError('PreciseInserter.findOptimalPosition', error);
            return {
                line: cursorLine,
                position: 'before',
                indentation: 0,
                reason: 'Fallback-Position'
            };
        }
    }

    /**
     * Erkennt Funktionsdefinition
     */
    private static isFunctionDeclaration(line: string, languageId: string): boolean {
        const patterns: { [key: string]: RegExp[] } = {
            'typescript': [
                /^(export\s+)?(async\s+)?function\s+\w+/,
                /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
                /^\w+\s*\([^)]*\)\s*:\s*\w+\s*{/
            ],
            'javascript': [
                /^(export\s+)?(async\s+)?function\s+\w+/,
                /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
                /^\w+\s*\([^)]*\)\s*{/
            ],
            'python': [
                /^def\s+\w+\s*\(/,
                /^async\s+def\s+\w+\s*\(/
            ],
            'java': [
                /^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/
            ],
            'csharp': [
                /^(public|private|protected)?\s*(static\s+)?(async\s+)?\w+\s+\w+\s*\(/
            ]
        };

        const languagePatterns = patterns[languageId] || patterns['javascript'];
        return languagePatterns.some(pattern => pattern.test(line));
    }

    /**
     * Erkennt Klassendefinition
     */
    private static isClassDeclaration(line: string, languageId: string): boolean {
        const patterns: { [key: string]: RegExp[] } = {
            'typescript': [
                /^(export\s+)?(abstract\s+)?class\s+\w+/,
                /^(export\s+)?interface\s+\w+/
            ],
            'javascript': [
                /^(export\s+)?class\s+\w+/
            ],
            'python': [
                /^class\s+\w+/
            ],
            'java': [
                /^(public|private)?\s*(abstract\s+)?class\s+\w+/
            ],
            'csharp': [
                /^(public|private|internal)?\s*(abstract\s+)?class\s+\w+/
            ]
        };

        const languagePatterns = patterns[languageId] || patterns['javascript'];
        return languagePatterns.some(pattern => pattern.test(line));
    }

    /**
     * Erkennt Methoden-Definition (in Klassen)
     */
    private static isMethodDeclaration(line: string, languageId: string): boolean {
        // Ähnlich wie Funktionen, aber oft eingerückt
        const indentedFunction = /^\s+(public|private|protected)?\s*(static\s+)?(async\s+)?\w+\s*\(/;
        return indentedFunction.test(line);
    }

    /**
     * Validiert ob Kommentar-Platzierung syntaktisch korrekt ist
     */
    static async validatePlacement(
        document: vscode.TextDocument,
        placement: CommentPlacement
    ): Promise<ValidationResult> {
        try {
            const line = document.lineAt(placement.targetLine);
            const lineText = line.text.trim();

            // Prüfe ob Zeile leer ist
            if (lineText.length === 0) {
                return {
                    isValid: true,
                    warnings: ['Zeile ist leer - Kommentar wird darüber platziert']
                };
            }

            // Prüfe ob bereits Kommentar vorhanden
            if (this.isComment(lineText, document.languageId)) {
                return {
                    isValid: false,
                    warnings: [],
                    errors: ['Zeile enthält bereits einen Kommentar']
                };
            }

            // Prüfe ob innerhalb eines Code-Blocks
            if (this.isInsideCodeBlock(document, placement.targetLine)) {
                return {
                    isValid: true,
                    warnings: ['Position ist innerhalb eines Code-Blocks - prüfe Syntax manuell']
                };
            }

            return {
                isValid: true,
                warnings: []
            };

        } catch (error) {
            ErrorHandler.handleError('PreciseInserter.validatePlacement', error);
            return {
                isValid: true,
                warnings: ['Validierung fehlgeschlagen - fortfahren auf eigenes Risiko']
            };
        }
    }

    /**
     * Prüft ob Zeile ein Kommentar ist
     */
    private static isComment(line: string, languageId: string): boolean {
        const commentPatterns: { [key: string]: RegExp[] } = {
            'typescript': [/^\/\//, /^\/\*/, /^\*/],
            'javascript': [/^\/\//, /^\/\*/, /^\*/],
            'python': [/^#/, /^"""/],
            'java': [/^\/\//, /^\/\*/, /^\*/],
            'csharp': [/^\/\//, /^\/\*/, /^\/\/\//]
        };

        const patterns = commentPatterns[languageId] || commentPatterns['javascript'];
        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * Prüft ob Position innerhalb eines Code-Blocks ist
     */
    private static isInsideCodeBlock(
        document: vscode.TextDocument,
        targetLine: number
    ): boolean {
        // Einfache Heuristik: Prüfe ob wir innerhalb von {}
        let openBraces = 0;
        
        for (let i = 0; i < targetLine; i++) {
            const line = document.lineAt(i).text;
            openBraces += (line.match(/{/g) || []).length;
            openBraces -= (line.match(/}/g) || []).length;
        }

        return openBraces > 0;
    }
}

/**
 * Optimale Position (Fallback-Analyse)
 */
export interface OptimalPosition {
    line: number;
    position: 'before' | 'after';
    indentation: number;
    reason: string;
}

/**
 * Validierungs-Resultat
 */
export interface ValidationResult {
    isValid: boolean;
    warnings: string[];
    errors?: string[];
}