import * as vscode from 'vscode';
import { CommentPlacement } from './claudeAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Position-Validator und Korrektor
 * 
 * Verhindert Syntaxfehler durch:
 * 1. Validierung der Kommentar-Position
 * 2. Automatische Korrektur bei Problemen
 * 3. Intelligente Erkennung von Funktions/Klassen-Grenzen
 */
export class PositionValidator {

    /**
     * Validiert und korrigiert eine Kommentar-Platzierung
     */
    static validateAndCorrect(
        document: vscode.TextDocument,
        placement: CommentPlacement
    ): CommentPlacement {
        ErrorHandler.log('PositionValidator', `Validiere Position: Zeile ${placement.targetLine}, ${placement.position}`);

        // 1. Prüfe ob Zeile existiert
        if (placement.targetLine < 0 || placement.targetLine >= document.lineCount) {
            ErrorHandler.log('PositionValidator', '⚠️ Zeile außerhalb des Dokuments, korrigiere...');
            placement.targetLine = Math.max(0, Math.min(placement.targetLine, document.lineCount - 1));
        }

        const targetLine = document.lineAt(placement.targetLine);
        const targetText = targetLine.text.trim();

        // 2. Erkenne Funktions/Klassen/Methoden-Definition
        const isFunctionStart = this.isFunctionOrClassStart(targetText, document.languageId);
        
        if (isFunctionStart) {
            // Funktion gefunden - Kommentar MUSS davor!
            if (placement.position === 'after') {
                ErrorHandler.log('PositionValidator', '🔧 Korrektur: Position AFTER → BEFORE (Funktionsdefinition erkannt)');
                placement.position = 'before';
                placement.reasoning = 'Automatisch korrigiert: Kommentar muss vor Funktionsdefinition stehen';
            }
        }

        // 3. Prüfe ob Zeile innerhalb eines Code-Blocks ist
        if (this.isInsideCodeBlock(document, placement.targetLine)) {
            ErrorHandler.log('PositionValidator', '⚠️ Position ist innerhalb Code-Block, suche bessere Position...');
            const correctedLine = this.findFunctionStart(document, placement.targetLine);
            
            if (correctedLine !== null) {
                ErrorHandler.log('PositionValidator', `✅ Korrigiert: ${placement.targetLine} → ${correctedLine}`);
                placement.targetLine = correctedLine;
                placement.position = 'before';
                placement.reasoning = 'Automatisch korrigiert: Funktionsstart gefunden';
            }
        }

        // 4. Prüfe ob bereits Kommentar vorhanden
        if (this.hasCommentBefore(document, placement.targetLine)) {
            ErrorHandler.log('PositionValidator', '⚠️ Kommentar bereits vorhanden, suche alternative Position...');
            // Füge NACH vorhandenem Kommentar ein (überschreibe ihn)
            const nextLine = this.skipExistingComments(document, placement.targetLine);
            if (nextLine !== placement.targetLine) {
                placement.targetLine = nextLine;
                placement.reasoning = 'Nach vorhandenem Kommentar platziert';
            }
        }

        // 5. Korrigiere Einrückung
        const correctIndentation = this.getCorrectIndentation(document, placement.targetLine);
        if (correctIndentation !== placement.indentation) {
            ErrorHandler.log('PositionValidator', `🔧 Einrückung korrigiert: ${placement.indentation} → ${correctIndentation}`);
            placement.indentation = correctIndentation;
        }

        ErrorHandler.log('PositionValidator', `✅ Validierte Position: Zeile ${placement.targetLine}, ${placement.position}, Einrückung ${placement.indentation}`, 'success');

        return placement;
    }

    /**
     * Prüft ob eine Zeile eine Funktions/Klassen/Methoden-Definition ist
     */
    private static isFunctionOrClassStart(line: string, languageId: string): boolean {
        // JavaScript/TypeScript
        if (languageId === 'javascript' || languageId === 'typescript' || languageId === 'javascriptreact' || languageId === 'typescriptreact') {
            return (
                // Funktionen
                /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+/.test(line) ||          
                // Klassen
                /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/.test(line) ||          
                // Interfaces
                /^\s*(?:export\s+)?interface\s+\w+/.test(line) ||                      
                // Types
                /^\s*(?:export\s+)?type\s+\w+\s*=/.test(line) ||                       
                // Methoden (mit oder ohne Modifier, mit oder ohne Typ, mit {)
                /^\s*\w+\s*\([^)]*\)(?:\s*:\s*\w+)?\s*\{/.test(line) ||             
                // Methoden mit Modifier
                /^\s*(?:public|private|protected|static|async)\s+\w+\s*\(/.test(line) ||
                // Arrow Functions
                /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/.test(line) ||
                // Function Expressions
                /^\s*(?:const|let|var)\s+\w+\s*=\s*function/.test(line) ||
                // Constructor
                /^\s*constructor\s*\(/.test(line)
            );
        }

        // Python
        if (languageId === 'python') {
            return (
                /^\s*(?:async\s+)?def\s+\w+\s*\(/.test(line) ||  // def function_name(
                /^\s*class\s+\w+/.test(line)                      // class ClassName
            );
        }

        // Java/C#
        if (languageId === 'java' || languageId === 'csharp') {
            return (
                /^\s*(?:public|private|protected)\s+(?:static\s+)?(?:async\s+)?\w+\s+\w+\s*\(/.test(line) || // method
                /^\s*(?:public|private|protected)?\s*(?:abstract\s+)?class\s+\w+/.test(line)                  // class
            );
        }

        // Go
        if (languageId === 'go') {
            return /^\s*func\s+/.test(line);
        }

        // Rust
        if (languageId === 'rust') {
            return (
                /^\s*(?:pub\s+)?fn\s+\w+/.test(line) ||  // fn function_name
                /^\s*(?:pub\s+)?struct\s+\w+/.test(line)  // struct Name
            );
        }

        return false;
    }

    /**
     * Prüft ob Position innerhalb eines Code-Blocks ist (zwischen {})
     */
    private static isInsideCodeBlock(document: vscode.TextDocument, line: number): boolean {
        let openBraces = 0;
        let closeBraces = 0;

        // Zähle Klammern von Anfang bis zur Zielzeile
        for (let i = 0; i <= line; i++) {
            const lineText = document.lineAt(i).text;
            
            // Ignoriere Klammern in Strings und Kommentaren (vereinfacht)
            const cleaned = this.removeStringsAndComments(lineText);
            
            openBraces += (cleaned.match(/{/g) || []).length;
            closeBraces += (cleaned.match(/}/g) || []).length;
        }

        // Wenn mehr öffnende als schließende Klammern → innerhalb Block
        return openBraces > closeBraces;
    }

    /**
     * Findet den Start einer Funktion/Methode rückwärts
     */
    private static findFunctionStart(document: vscode.TextDocument, startLine: number): number | null {
        const languageId = document.languageId;

        // Suche rückwärts nach Funktionsdefinition
        for (let i = startLine; i >= Math.max(0, startLine - 30); i--) {
            const lineText = document.lineAt(i).text.trim();
            
            if (this.isFunctionOrClassStart(lineText, languageId)) {
                ErrorHandler.log('PositionValidator', `Funktionsstart gefunden: Zeile ${i}`);
                return i;
            }
        }

        ErrorHandler.log('PositionValidator', 'Kein Funktionsstart gefunden');
        return null;
    }

    /**
     * Prüft ob bereits ein Kommentar vor der Zeile existiert
     */
    private static hasCommentBefore(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;

        const previousLine = document.lineAt(line - 1).text.trim();
        
        return (
            previousLine.startsWith('//') ||
            previousLine.startsWith('/*') ||
            previousLine.startsWith('*') ||
            previousLine.startsWith('#') ||
            previousLine.startsWith('"""') ||
            previousLine.includes('*/') ||
            previousLine.startsWith('///')
        );
    }

    /**
     * Überspringt existierende Kommentare
     */
    private static skipExistingComments(document: vscode.TextDocument, line: number): number {
        let currentLine = line;

        // Gehe rückwärts durch Kommentar-Block
        while (currentLine > 0) {
            const lineText = document.lineAt(currentLine - 1).text.trim();
            
            if (this.isCommentLine(lineText)) {
                currentLine--;
            } else {
                break;
            }
        }

        return currentLine;
    }

    /**
     * Prüft ob Zeile ein Kommentar ist
     */
    private static isCommentLine(line: string): boolean {
        return (
            line.startsWith('//') ||
            line.startsWith('/*') ||
            line.startsWith('*') ||
            line.startsWith('#') ||
            line.startsWith('"""') ||
            line.includes('*/') ||
            line.startsWith('///')
        );
    }

    /**
     * Ermittelt korrekte Einrückung
     */
    private static getCorrectIndentation(document: vscode.TextDocument, line: number): number {
        // Nutze Einrückung der Zielzeile
        const targetLine = document.lineAt(line);
        const indentation = targetLine.firstNonWhitespaceCharacterIndex;

        // Wenn Zeile leer ist, schaue zur nächsten nicht-leeren Zeile
        if (targetLine.text.trim().length === 0) {
            for (let i = line + 1; i < Math.min(line + 5, document.lineCount); i++) {
                const nextLine = document.lineAt(i);
                if (nextLine.text.trim().length > 0) {
                    return nextLine.firstNonWhitespaceCharacterIndex;
                }
            }
        }

        return indentation;
    }

    /**
     * Entfernt Strings und Kommentare aus Zeile (für Klammer-Zählung)
     */
    private static removeStringsAndComments(line: string): string {
        // Entferne String-Literale
        let cleaned = line.replace(/"[^"]*"/g, '');
        cleaned = cleaned.replace(/'[^']*'/g, '');
        cleaned = cleaned.replace(/`[^`]*`/g, '');
        
        // Entferne Kommentare
        cleaned = cleaned.replace(/\/\/.*/g, '');
        cleaned = cleaned.replace(/\/\*.*?\*\//g, '');
        
        return cleaned;
    }

    /**
     * Gibt detaillierte Diagnose für Debugging
     */
    static diagnose(document: vscode.TextDocument, line: number): string {
        const lineText = document.lineAt(line).text;
        const isFunctionStart = this.isFunctionOrClassStart(lineText.trim(), document.languageId);
        const isInsideBlock = this.isInsideCodeBlock(document, line);
        const hasComment = this.hasCommentBefore(document, line);
        const indentation = this.getCorrectIndentation(document, line);

        return `
📊 Position-Diagnose für Zeile ${line}:
  Text: "${lineText.trim()}"
  Ist Funktionsstart: ${isFunctionStart ? '✅' : '❌'}
  Innerhalb Code-Block: ${isInsideBlock ? '⚠️ JA' : '✅ NEIN'}
  Hat Kommentar davor: ${hasComment ? '⚠️ JA' : '✅ NEIN'}
  Einrückung: ${indentation} Leerzeichen
        `.trim();
    }
}
