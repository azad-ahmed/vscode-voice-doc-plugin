import * as vscode from 'vscode';
import { OfflineCodeAnalyzer, CodeStructureInfo } from './offlineAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Intelligenter Offline-Kommentar-Placer
 * 
 * Funktioniert OHNE externe APIs durch:
 * 1. VS Code Language Server Integration
 * 2. AST-basierte Code-Analyse
 * 3. Intelligente Heuristiken
 * 
 * Dieser Placer ist SMART genug um:
 * - Code-Struktur zu verstehen
 * - Optimale Position zu finden
 * - Syntaxfehler zu vermeiden
 * - Sprachspezifisch zu formatieren
 */
export class SmartOfflinePlacer {

    /**
     * Platziert Kommentar intelligent basierend auf Code-Struktur-Analyse
     */
    static async placeCommentIntelligently(
        editor: vscode.TextEditor,
        commentText: string,
        position: vscode.Position
    ): Promise<PlacementResult> {
        try {
            ErrorHandler.log('SmartOfflinePlacer', '🧠 Starte intelligente Platzierung (offline)...');

            const document = editor.document;
            
            // Phase 1: Analysiere Code-Struktur
            const structure = await OfflineCodeAnalyzer.analyzeCodeStructure(document, position);
            
            ErrorHandler.log('SmartOfflinePlacer', 
                `📊 Struktur erkannt: ${structure.type} "${structure.name}" (Konfidenz: ${Math.round(structure.confidence * 100)}%)`
            );

            // Phase 2: Formatiere Kommentar sprachspezifisch
            const formattedComment = this.formatCommentForLanguage(
                commentText,
                document.languageId,
                structure
            );

            // Phase 3: Bestimme exakte Einfüge-Position
            const insertPosition = this.calculateInsertPosition(
                document,
                structure
            );

            // Phase 4: Validiere Platzierung
            const validation = this.validatePlacement(
                document,
                insertPosition,
                structure
            );

            if (!validation.isValid) {
                ErrorHandler.log('SmartOfflinePlacer', `⚠️ Validierung fehlgeschlagen: ${validation.reason}`);
                
                // Fallback: Sichere Position
                return {
                    success: false,
                    reason: validation.reason,
                    fallbackPosition: position
                };
            }

            // Phase 5: Füge Kommentar ein
            const success = await editor.edit(editBuilder => {
                const commentWithIndent = this.addIndentation(
                    formattedComment,
                    structure.indentation
                );
                
                editBuilder.insert(insertPosition, commentWithIndent + '\n');
            });

            if (success) {
                ErrorHandler.log('SmartOfflinePlacer', '✅ Kommentar erfolgreich platziert!', 'success');
                
                // Zeige Erfolgs-Message
                vscode.window.showInformationMessage(
                    `✅ Kommentar für ${structure.type} "${structure.name}" eingefügt!`
                );

                return {
                    success: true,
                    structure: structure,
                    insertedAt: insertPosition
                };
            } else {
                return {
                    success: false,
                    reason: 'Editor.edit fehlgeschlagen'
                };
            }

        } catch (error: any) {
            ErrorHandler.handleError('SmartOfflinePlacer.placeCommentIntelligently', error);
            
            return {
                success: false,
                reason: error.message
            };
        }
    }

    /**
     * Formatiert Kommentar sprachspezifisch
     */
    private static formatCommentForLanguage(
        text: string,
        languageId: string,
        structure: CodeStructureInfo
    ): string {
        // Bereinige Text
        text = text.trim();
        
        // Großschreibung
        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        // Punkt hinzufügen
        if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
            text += '.';
        }

        // Sprachspezifische Formatierung
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                return this.formatJSDoc(text, structure);
            
            case 'python':
                return this.formatPythonDocstring(text, structure);
            
            case 'java':
            case 'csharp':
                return this.formatJavaDoc(text, structure);
            
            case 'php':
                return this.formatPHPDoc(text, structure);
            
            case 'go':
                return this.formatGoComment(text, structure);
            
            case 'rust':
                return this.formatRustComment(text, structure);
            
            default:
                return `// ${text}`;
        }
    }

    /**
     * JSDoc-Formatierung
     */
    private static formatJSDoc(text: string, structure: CodeStructureInfo): string {
        const lines = ['/**', ` * ${text}`];
        
        // Füge @param und @returns hinzu für Funktionen/Methoden
        if (structure.type === 'function' || structure.type === 'method') {
            // Versuche Parameter zu erkennen (vereinfacht)
            lines.push(` * @returns Beschreibung des Rückgabewerts`);
        }
        
        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * Python Docstring-Formatierung
     */
    private static formatPythonDocstring(text: string, structure: CodeStructureInfo): string {
        if (structure.type === 'function' || structure.type === 'method') {
            return `    """\n    ${text}\n    \n    Args:\n        Parameter: Beschreibung\n    \n    Returns:\n        Rückgabewert\n    """`;
        }
        
        return `"""\n${text}\n"""`;
    }

    /**
     * JavaDoc-Formatierung
     */
    private static formatJavaDoc(text: string, structure: CodeStructureInfo): string {
        const lines = ['/**', ` * ${text}`];
        
        if (structure.type === 'method' || structure.type === 'function') {
            lines.push(` * @return Beschreibung`);
        }
        
        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * PHPDoc-Formatierung
     */
    private static formatPHPDoc(text: string, structure: CodeStructureInfo): string {
        const lines = ['/**', ` * ${text}`];
        
        if (structure.type === 'method' || structure.type === 'function') {
            lines.push(` * @return mixed`);
        }
        
        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * Go-Comment-Formatierung
     */
    private static formatGoComment(text: string, structure: CodeStructureInfo): string {
        // Go-Konvention: Kommentar beginnt mit Funktionsname
        if (structure.type === 'function' && structure.name) {
            return `// ${structure.name} ${text.toLowerCase()}`;
        }
        return `// ${text}`;
    }

    /**
     * Rust-Dokumentations-Kommentar
     */
    private static formatRustComment(text: string, structure: CodeStructureInfo): string {
        return `/// ${text}`;
    }

    /**
     * Berechnet exakte Einfüge-Position
     */
    private static calculateInsertPosition(
        document: vscode.TextDocument,
        structure: CodeStructureInfo
    ): vscode.Position {
        let targetLine = structure.insertLine;

        // Für Python: Docstring NACH der def-Zeile
        if (document.languageId === 'python' && 
            (structure.type === 'function' || structure.type === 'method')) {
            targetLine = structure.startLine + 1;
            return new vscode.Position(targetLine, 0);
        }

        // Für andere Sprachen: VOR der Definition
        
        // Prüfe ob bereits Kommentar vorhanden (direkt davor)
        if (targetLine > 0) {
            const previousLine = document.lineAt(targetLine - 1);
            const prevText = previousLine.text.trim();
            
            // Wenn Kommentar vorhanden, füge DAVOR ein
            if (prevText.startsWith('/**') || prevText.startsWith('//') || prevText.startsWith('#')) {
                ErrorHandler.log('SmartOfflinePlacer', '⚠️ Kommentar bereits vorhanden, füge davor ein');
                targetLine = targetLine - 1;
            }
        }

        return new vscode.Position(targetLine, 0);
    }

    /**
     * Validiert Platzierung
     */
    private static validatePlacement(
        document: vscode.TextDocument,
        position: vscode.Position,
        structure: CodeStructureInfo
    ): ValidationResult {
        // Prüfe ob Position gültig
        if (position.line < 0 || position.line >= document.lineCount) {
            return {
                isValid: false,
                reason: 'Position außerhalb des Dokuments'
            };
        }

        // Prüfe ob wir in einem Code-Block sind (nicht gut)
        const blockStructure = OfflineCodeAnalyzer.analyzeBlockStructure(
            document,
            Math.max(0, position.line - 20),
            Math.min(document.lineCount - 1, position.line + 5)
        );

        // Wenn wir tief verschachtelt sind, warnen
        if (blockStructure.depth > 2) {
            ErrorHandler.log('SmartOfflinePlacer', 
                `⚠️ Tief verschachtelt (Tiefe: ${blockStructure.depth})`
            );
        }

        // Prüfe ob Zeile leer ist (ideal)
        const line = document.lineAt(position.line);
        if (line.text.trim().length === 0) {
            return {
                isValid: true,
                reason: 'Leere Zeile - ideal'
            };
        }

        // Prüfe Konfidenz der Struktur-Erkennung
        if (structure.confidence < 0.5) {
            return {
                isValid: true,
                reason: 'Niedrige Konfidenz, aber akzeptabel',
                warnings: ['Struktur-Erkennung unsicher']
            };
        }

        return {
            isValid: true,
            reason: 'Platzierung valide'
        };
    }

    /**
     * Fügt Einrückung hinzu
     */
    private static addIndentation(text: string, indentation: number): string {
        const indent = ' '.repeat(indentation);
        const lines = text.split('\n');
        
        return lines.map((line, index) => {
            // Erste Zeile: Volle Einrückung
            if (index === 0) {
                return indent + line;
            }
            // Weitere Zeilen: Einrückung + ein Leerzeichen für Kommentar-Stil
            if (line.trim().startsWith('*') || line.trim().startsWith('//')) {
                return indent + ' ' + line.trim();
            }
            return indent + line;
        }).join('\n');
    }

    /**
     * Analysiert Kontext für bessere Kommentar-Generierung
     */
    static async analyzeContext(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ContextAnalysis> {
        const structure = await OfflineCodeAnalyzer.analyzeCodeStructure(document, position);
        
        // Extrahiere umgebenden Code
        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);
        
        const contextLines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            contextLines.push(document.lineAt(i).text);
        }

        return {
            structure: structure,
            surroundingCode: contextLines.join('\n'),
            languageId: document.languageId,
            hasExistingComments: this.checkForExistingComments(document, structure.startLine)
        };
    }

    /**
     * Prüft ob bereits Kommentare vorhanden sind
     */
    private static checkForExistingComments(
        document: vscode.TextDocument,
        targetLine: number
    ): boolean {
        // Prüfe 3 Zeilen davor
        for (let i = Math.max(0, targetLine - 3); i < targetLine; i++) {
            const line = document.lineAt(i).text.trim();
            if (line.startsWith('//') || line.startsWith('/*') || 
                line.startsWith('*') || line.startsWith('#') ||
                line.startsWith('"""')) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Platzierungs-Resultat
 */
export interface PlacementResult {
    success: boolean;
    structure?: CodeStructureInfo;
    insertedAt?: vscode.Position;
    reason?: string;
    fallbackPosition?: vscode.Position;
}

/**
 * Validierungs-Resultat
 */
interface ValidationResult {
    isValid: boolean;
    reason: string;
    warnings?: string[];
}

/**
 * Kontext-Analyse
 */
export interface ContextAnalysis {
    structure: CodeStructureInfo;
    surroundingCode: string;
    languageId: string;
    hasExistingComments: boolean;
}
