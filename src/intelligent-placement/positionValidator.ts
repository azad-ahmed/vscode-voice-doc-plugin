import * as vscode from 'vscode';
import { CommentPlacement } from './claudeAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * 🔧 VERBESSERTER Position-Validator mit Batch-Support
 * 
 * Verhindert Syntaxfehler und doppelte Platzierungen durch:
 * 1. Validierung der Kommentar-Position
 * 2. Automatische Korrektur bei Problemen
 * 3. Intelligente Erkennung von Funktions/Klassen-Grenzen
 * 4. Batch-Awareness: Verhindert mehrere Kommentare an derselben Position
 */
export class PositionValidator {
    // 🆕 Track verwendete Positionen innerhalb eines Batches
    private static usedPositions: Map<string, Set<number>> = new Map();

    /**
     * 🆕 Startet einen neuen Batch (löscht verwendete Positionen)
     */
    static startBatch(documentUri: string): void {
        this.usedPositions.set(documentUri, new Set());
        ErrorHandler.log('PositionValidator', `🆕 Neuer Batch gestartet für ${documentUri}`);
    }

    /**
     * 🆕 Markiert eine Position als verwendet
     */
    static markPositionAsUsed(documentUri: string, line: number): void {
        if (!this.usedPositions.has(documentUri)) {
            this.usedPositions.set(documentUri, new Set());
        }
        this.usedPositions.get(documentUri)!.add(line);
        ErrorHandler.log('PositionValidator', `✅ Position ${line} als verwendet markiert`);
    }

    /**
     * 🆕 Prüft ob Position bereits verwendet wurde
     */
    static isPositionUsed(documentUri: string, line: number): boolean {
        return this.usedPositions.get(documentUri)?.has(line) || false;
    }

    /**
     * 🆕 Beendet einen Batch (optional)
     */
    static endBatch(documentUri: string): void {
        this.usedPositions.delete(documentUri);
        ErrorHandler.log('PositionValidator', `✅ Batch beendet für ${documentUri}`);
    }

    /**
     * Validiert und korrigiert eine Kommentar-Platzierung
     * 🔧 VERBESSERT: Berücksichtigt bereits verwendete Positionen im Batch
     */
    static validateAndCorrect(
        document: vscode.TextDocument,
        placement: CommentPlacement,
        respectBatchPositions: boolean = true
    ): CommentPlacement {
        const documentUri = document.uri.toString();
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
                ErrorHandler.log('PositionValidator', `Funktionsstart gefunden: ${correctedLine}`);
                placement.targetLine = correctedLine;
                placement.position = 'before';
                placement.reasoning = 'Automatisch korrigiert: Funktionsstart gefunden';
            }
        }

        // 4. 🆕 Prüfe ob Position bereits im Batch verwendet wurde
        if (respectBatchPositions && this.isPositionUsed(documentUri, placement.targetLine)) {
            ErrorHandler.log('PositionValidator', `⚠️ Position ${placement.targetLine} bereits im Batch verwendet, suche alternative...`);
            
            // Suche nächste freie Position (nicht nach oben, sondern bleibe bei der eigentlichen Funktion!)
            const alternativeLine = this.findAlternativePosition(document, placement.targetLine, documentUri);
            
            if (alternativeLine !== null) {
                ErrorHandler.log('PositionValidator', `✅ Alternative Position gefunden: ${placement.targetLine} → ${alternativeLine}`);
                placement.targetLine = alternativeLine;
                placement.reasoning = 'Alternative Position wegen Batch-Konflikt';
            } else {
                ErrorHandler.log('PositionValidator', '⚠️ Keine alternative Position gefunden, behalte Original');
            }
        }

        // 5. Prüfe ob bereits Kommentar vorhanden (aber überschreibe NICHT)
        if (this.hasCommentBefore(document, placement.targetLine)) {
            ErrorHandler.log('PositionValidator', `⚠️ Kommentar bereits vorhanden bei Zeile ${placement.targetLine}`);
            
            // 🔧 WICHTIG: Suche die EIGENTLICHE Funktion für diesen Kommentar
            const actualFunctionLine = this.findNextFunction(document, placement.targetLine);
            
            if (actualFunctionLine !== null && actualFunctionLine !== placement.targetLine) {
                ErrorHandler.log('PositionValidator', `✅ Eigentliche Funktion gefunden: ${actualFunctionLine}`);
                placement.targetLine = actualFunctionLine;
                placement.position = 'before';
                placement.reasoning = 'Korrigiert zu eigentlicher Funktionsdefinition';
            }
        }

        // 6. Korrigiere Einrückung
        const correctIndentation = this.getCorrectIndentation(document, placement.targetLine);
        if (correctIndentation !== placement.indentation) {
            ErrorHandler.log('PositionValidator', `🔧 Einrückung korrigiert: ${placement.indentation} → ${correctIndentation}`);
            placement.indentation = correctIndentation;
        }

        ErrorHandler.log('PositionValidator', `✅ Validierte Position: Zeile ${placement.targetLine}, ${placement.position}, Einrückung ${placement.indentation}`, 'success');

        return placement;
    }

    /**
     * 🆕 Findet alternative Position wenn die gewünschte bereits belegt ist
     * WICHTIG: Sucht NICHT nach oben, sondern bleibt in der Nähe der Original-Position
     */
    private static findAlternativePosition(
        document: vscode.TextDocument,
        originalLine: number,
        documentUri: string
    ): number | null {
        // 🔧 NEUE STRATEGIE: Wenn Position belegt ist, gib die Original-Position zurück
        // aber nur wenn sie WIRKLICH die richtige Funktionsdefinition ist
        
        // Prüfe ob originalLine tatsächlich eine Funktionsdefinition ist
        const lineText = document.lineAt(originalLine).text.trim();
        if (this.isFunctionOrClassStart(lineText, document.languageId)) {
            // Das ist eine echte Funktion - behalte diese Position, auch wenn schon ein Kommentar da ist
            // Der Benutzer muss dann entscheiden, ob er überschreiben will
            return originalLine;
        }

        // Wenn nicht, suche die nächste Funktionsdefinition nach unten (maximal 10 Zeilen)
        for (let i = originalLine + 1; i < Math.min(originalLine + 10, document.lineCount); i++) {
            const line = document.lineAt(i).text.trim();
            
            // Skip leere Zeilen und Kommentare
            if (line.length === 0 || this.isCommentLine(line)) {
                continue;
            }
            
            if (this.isFunctionOrClassStart(line, document.languageId)) {
                // Prüfe ob diese Position frei ist
                if (!this.isPositionUsed(documentUri, i)) {
                    return i;
                }
            }
        }

        return null;
    }

    /**
     * 🆕 Findet die nächste Funktionsdefinition nach der aktuellen Position
     */
    private static findNextFunction(
        document: vscode.TextDocument,
        startLine: number
    ): number | null {
        // Suche nach unten nach der nächsten Funktionsdefinition (maximal 15 Zeilen)
        for (let i = startLine + 1; i < Math.min(startLine + 15, document.lineCount); i++) {
            const lineText = document.lineAt(i).text.trim();
            
            // Skip leere Zeilen und Kommentare
            if (lineText.length === 0 || this.isCommentLine(lineText)) {
                continue;
            }
            
            if (this.isFunctionOrClassStart(lineText, document.languageId)) {
                return i;
            }
        }

        return null;
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
                /^\s*(?:async\s+)?def\s+\w+\s*\(/.test(line) ||  
                /^\s*class\s+\w+/.test(line)                      
            );
        }

        // Java/C#
        if (languageId === 'java' || languageId === 'csharp') {
            return (
                /^\s*(?:public|private|protected)\s+(?:static\s+)?(?:async\s+)?\w+\s+\w+\s*\(/.test(line) ||
                /^\s*(?:public|private|protected)?\s*(?:abstract\s+)?class\s+\w+/.test(line)                  
            );
        }

        // Go
        if (languageId === 'go') {
            return /^\s*func\s+/.test(line);
        }

        // Rust
        if (languageId === 'rust') {
            return (
                /^\s*(?:pub\s+)?fn\s+\w+/.test(line) ||  
                /^\s*(?:pub\s+)?struct\s+\w+/.test(line)  
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
        const isUsed = this.isPositionUsed(document.uri.toString(), line);

        return `
📊 Position-Diagnose für Zeile ${line}:
  Text: "${lineText.trim()}"
  Ist Funktionsstart: ${isFunctionStart ? '✅' : '❌'}
  Innerhalb Code-Block: ${isInsideBlock ? '⚠️ JA' : '✅ NEIN'}
  Hat Kommentar davor: ${hasComment ? '⚠️ JA' : '✅ NEIN'}
  Bereits im Batch verwendet: ${isUsed ? '⚠️ JA' : '✅ NEIN'}
  Einrückung: ${indentation} Leerzeichen
        `.trim();
    }
}
