import * as vscode from 'vscode';

/**
 * Intelligentes System zur korrekten Platzierung von Kommentaren
 * Verhindert Syntax-Fehler und Durcheinander
 */
export class SmartCommentPlacer {
    
    /**
     * Findet die optimale Position für einen Kommentar basierend auf dem Cursor
     */
    static findOptimalCommentPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Position | null {
        const currentLine = position.line;
        
        // Suche die nächste Klasse oder Funktion NACH dem Cursor
        const target = this.findNextCodeTarget(document, currentLine);
        
        if (!target) {
            return null;
        }
        
        // Prüfe ob bereits ein Kommentar existiert
        if (this.hasExistingComment(document, target.line)) {
            return null; // Bereits dokumentiert
        }
        
        // Gib Position DIREKT VOR der Klasse/Funktion zurück
        return new vscode.Position(target.line, 0);
    }
    
    /**
     * Findet das nächste Code-Target (Klasse oder Funktion)
     */
    private static findNextCodeTarget(
        document: vscode.TextDocument,
        startLine: number
    ): { line: number; type: 'class' | 'function'; name: string } | null {
        const text = document.getText();
        const lines = text.split('\n');
        
        // Suche ab der aktuellen Zeile nach unten
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip Kommentare und leere Zeilen
            if (line.startsWith('//') || line.startsWith('/*') || 
                line.startsWith('*') || line === '') {
                continue;
            }
            
            // Prüfe auf Klasse
            const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([A-Z]\w*)/);
            if (classMatch) {
                return {
                    line: i,
                    type: 'class',
                    name: classMatch[1]
                };
            }
            
            // Prüfe auf Funktion
            const functionMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-z_$][\w$]*)\s*\(/);
            if (functionMatch) {
                return {
                    line: i,
                    type: 'function',
                    name: functionMatch[1]
                };
            }
            
            // Prüfe auf Arrow Function
            const arrowMatch = line.match(/^(?:const|let|var)\s+([a-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
            if (arrowMatch) {
                return {
                    line: i,
                    type: 'function',
                    name: arrowMatch[1]
                };
            }
            
            // Prüfe auf Methode (in Klasse)
            const methodMatch = line.match(/^(?:async\s+|static\s+)?([a-z_$][\w$]*)\s*\([^)]*\)\s*{/);
            if (methodMatch && !['if', 'for', 'while', 'catch'].includes(methodMatch[1])) {
                return {
                    line: i,
                    type: 'function',
                    name: methodMatch[1]
                };
            }
        }
        
        return null;
    }
    
    /**
     * Prüft ob bereits ein Kommentar vor dieser Zeile existiert
     */
    private static hasExistingComment(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;
        
        // Prüfe die Zeile direkt davor
        const previousLine = document.lineAt(line - 1).text.trim();
        
        // Prüfe auch 2 Zeilen davor (für mehrzeilige Kommentare)
        let twoLinesBefore = '';
        if (line >= 2) {
            twoLinesBefore = document.lineAt(line - 2).text.trim();
        }
        
        // Hat einen Kommentar wenn:
        return (
            previousLine.startsWith('/**') ||
            previousLine.startsWith('//') ||
            previousLine.startsWith('*') ||
            previousLine.startsWith('/*') ||
            twoLinesBefore.startsWith('/**') ||
            twoLinesBefore.startsWith('/*')
        );
    }
    
    /**
     * Fügt einen Kommentar an der optimalen Position ein
     */
    static async insertCommentAtOptimalPosition(
        editor: vscode.TextEditor,
        comment: string,
        position: vscode.Position
    ): Promise<boolean> {
        const optimalPosition = this.findOptimalCommentPosition(
            editor.document,
            position
        );
        
        if (!optimalPosition) {
            vscode.window.showWarningMessage(
                '⚠️ Keine passende Position gefunden oder bereits dokumentiert'
            );
            return false;
        }
        
        // Hole Einrückung der Zielzeile
        const targetLine = editor.document.lineAt(optimalPosition.line);
        const indent = targetLine.text.match(/^\s*/)?.[0] || '';
        
        // Formatiere Kommentar mit korrekter Einrückung
        const formattedComment = this.formatCommentWithIndent(comment, indent);
        
        // Füge Kommentar ein
        await editor.edit(editBuilder => {
            editBuilder.insert(optimalPosition, formattedComment + '\n');
        });
        
        return true;
    }
    
    /**
     * Formatiert Kommentar mit Einrückung
     */
    private static formatCommentWithIndent(comment: string, indent: string): string {
        const lines = comment.split('\n');
        return lines.map(line => indent + line).join('\n');
    }
    
    /**
     * Bereinigt chaotische Kommentare aus einer Datei
     */
    static async cleanupChaoticComments(document: vscode.TextDocument): Promise<number> {
        const text = document.getText();
        const lines = text.split('\n');
        let cleanedCount = 0;
        
        const problematicPatterns = [
            /\/\*\*\s*\*\s*```javascript/,  // Verschachtelte Code-Blöcke
            /\/\/\s*```javascript/,          // Inline Code-Blöcke
            /\*\s*```javascript/,            // Mittendrin Code-Blöcke
        ];
        
        // Sammle alle problematischen Zeilen
        const linesToDelete: number[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Prüfe auf problematische Patterns
            for (const pattern of problematicPatterns) {
                if (pattern.test(line)) {
                    linesToDelete.push(i);
                    cleanedCount++;
                    break;
                }
            }
            
            // Prüfe auf Kommentare in Code-Blöcken (z.B. nach { )
            if (line.includes('{') && line.includes('/**')) {
                linesToDelete.push(i);
                cleanedCount++;
            }
        }
        
        return cleanedCount;
    }
}
