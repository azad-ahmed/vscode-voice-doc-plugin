import * as vscode from 'vscode';
import { ClaudeAnalyzer, CommentPlacement } from './claudeAnalyzer';
import { PreciseCommentInserter } from './preciseInserter';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Intelligenter Kommentar-Orchestrator
 * 
 * Koordiniert den gesamten Workflow:
 * 1. Code-Kontext an Claude senden
 * 2. Intelligente Platzierungs-Analyse von Claude erhalten
 * 3. Kommentar präzise platzieren
 * 4. Syntaxfehler vermeiden
 * 
 * Dies ist das HAUPTSYSTEM für intelligente Kommentar-Platzierung!
 */
export class IntelligentCommentOrchestrator {

    /**
     * Hauptmethode: Verarbeitet Voice-Input und platziert Kommentar intelligent
     */
    static async processVoiceInputAndPlace(
        editor: vscode.TextEditor,
        transcribedText: string
    ): Promise<boolean> {
        try {
            ErrorHandler.log('IntelligentOrchestrator', '🚀 Starte intelligente Kommentar-Platzierung');
            ErrorHandler.log('IntelligentOrchestrator', `Input: "${transcribedText}"`);

            const document = editor.document;
            const cursorLine = editor.selection.active.line;

            // Phase 1: Claude-Analyse
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🤖 Claude analysiert Code-Struktur...',
                cancellable: false
            }, async () => {
                // Kurze Delay für bessere UX
                await new Promise(resolve => setTimeout(resolve, 500));
            });

            const claudeAvailable = await ClaudeAnalyzer.isAvailable();
            
            let placement: CommentPlacement | null = null;

            if (claudeAvailable) {
                // Nutze Claude für intelligente Analyse
                ErrorHandler.log('IntelligentOrchestrator', '🧠 Nutze Claude-powered Analyse');
                
                placement = await ClaudeAnalyzer.analyzeAndPlaceComment(
                    document,
                    cursorLine,
                    transcribedText
                );
            }

            // Phase 2: Fallback falls Claude nicht verfügbar
            if (!placement) {
                ErrorHandler.log('IntelligentOrchestrator', '⚠️ Claude nicht verfügbar, nutze Fallback-Analyse');
                
                const optimalPos = await PreciseCommentInserter.findOptimalPosition(
                    document,
                    cursorLine
                );

                // Erstelle einfachen Kommentar
                placement = {
                    comment: this.formatSimpleComment(transcribedText, document.languageId),
                    targetLine: optimalPos.line,
                    position: optimalPos.position,
                    indentation: optimalPos.indentation,
                    reasoning: optimalPos.reason + ' (Fallback-Modus)'
                };
            }

            // Phase 3: Validierung
            ErrorHandler.log('IntelligentOrchestrator', '✅ Validiere Platzierung...');
            
            const validation = await PreciseCommentInserter.validatePlacement(
                document,
                placement
            );

            if (!validation.isValid) {
                const errors = validation.errors?.join('\n') || 'Unbekannter Fehler';
                vscode.window.showErrorMessage(
                    `❌ Kommentar kann nicht platziert werden:\n${errors}`
                );
                return false;
            }

            if (validation.warnings.length > 0) {
                ErrorHandler.log('IntelligentOrchestrator', `⚠️ Warnungen: ${validation.warnings.join(', ')}`);
            }

            // Phase 4: Kommentar einfügen
            ErrorHandler.log('IntelligentOrchestrator', '📝 Füge Kommentar ein...');
            
            const success = await PreciseCommentInserter.insertComment(editor, placement);

            if (success) {
                ErrorHandler.log('IntelligentOrchestrator', '✅ Intelligente Platzierung erfolgreich!', 'success');
                
                // Zeige Statistik
                this.showPlacementStatistics(placement);
            }

            return success;

        } catch (error: any) {
            ErrorHandler.handleError('IntelligentOrchestrator.processVoiceInputAndPlace', error);
            
            // Zeige User-freundliche Fehlermeldung
            vscode.window.showErrorMessage(
                `❌ Intelligente Platzierung fehlgeschlagen: ${error.message}\n\nFallback: Nutze manuelle Platzierung`
            );
            
            return false;
        }
    }

    /**
     * Formatiert einfachen Kommentar für Fallback-Modus
     */
    private static formatSimpleComment(text: string, languageId: string): string {
        // Bereinige Text
        text = text.trim();
        
        // Großschreibung am Anfang
        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        // Füge Punkt hinzu falls nicht vorhanden
        if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
            text += '.';
        }

        // Sprachspezifische Formatierung
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                return `/**\n * ${text}\n */`;
            
            case 'python':
                return `"""\n${text}\n"""`;
            
            case 'java':
            case 'csharp':
                return `/**\n * ${text}\n */`;
            
            case 'php':
                return `/**\n * ${text}\n */`;
            
            case 'go':
                return `// ${text}`;
            
            case 'rust':
                return `/// ${text}`;
            
            default:
                return `// ${text}`;
        }
    }

    /**
     * Zeigt Platzierungs-Statistik an
     */
    private static showPlacementStatistics(placement: CommentPlacement): void {
        const stats = [
            `📍 Zeile: ${placement.targetLine}`,
            `📏 Position: ${placement.position === 'before' ? 'Vor' : 'Nach'}`,
            `⬜ Einrückung: ${placement.indentation} Leerzeichen`,
            `💡 Grund: ${placement.reasoning}`
        ].join('\n');

        ErrorHandler.log('IntelligentOrchestrator', '\n' + '='.repeat(50));
        ErrorHandler.log('IntelligentOrchestrator', '📊 PLATZIERUNGS-STATISTIK:');
        ErrorHandler.log('IntelligentOrchestrator', stats);
        ErrorHandler.log('IntelligentOrchestrator', '='.repeat(50) + '\n');
    }

    /**
     * Test-Methode: Analysiert Code ohne Kommentar einzufügen
     */
    static async analyzeOnly(
        editor: vscode.TextEditor,
        transcribedText: string
    ): Promise<CommentPlacement | null> {
        try {
            const document = editor.document;
            const cursorLine = editor.selection.active.line;

            const placement = await ClaudeAnalyzer.analyzeAndPlaceComment(
                document,
                cursorLine,
                transcribedText
            );

            if (placement) {
                // Zeige Analyse-Resultat
                const analysis = [
                    `🧠 Claude's Analyse:`,
                    ``,
                    `Kommentar:`,
                    placement.comment,
                    ``,
                    `Platzierung:`,
                    `  Zeile: ${placement.targetLine}`,
                    `  Position: ${placement.position}`,
                    `  Einrückung: ${placement.indentation}`,
                    `  Grund: ${placement.reasoning}`
                ].join('\n');

                vscode.window.showInformationMessage(
                    analysis,
                    { modal: true }
                );
            }

            return placement;

        } catch (error: any) {
            ErrorHandler.handleError('IntelligentOrchestrator.analyzeOnly', error);
            return null;
        }
    }

    /**
     * Batch-Verarbeitung: Mehrere Kommentare intelligent platzieren
     */
    static async batchProcess(
        editor: vscode.TextEditor,
        items: Array<{ text: string, line: number }>
    ): Promise<number> {
        let successCount = 0;

        for (const item of items) {
            // Setze Cursor auf Zielzeile
            const position = new vscode.Position(item.line, 0);
            editor.selection = new vscode.Selection(position, position);

            const success = await this.processVoiceInputAndPlace(editor, item.text);
            if (success) {
                successCount++;
            }

            // Kurze Pause zwischen Einfügungen
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        vscode.window.showInformationMessage(
            `✅ Batch-Verarbeitung abgeschlossen!\n${successCount}/${items.length} Kommentare erfolgreich platziert`
        );

        return successCount;
    }
}
