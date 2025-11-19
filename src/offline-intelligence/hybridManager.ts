import * as vscode from 'vscode';
import { ASTCodeAnalyzer, CodeStructure } from './astAnalyzer';
import { SmartCommentGenerator } from './smartCommentGenerator';
import { ClaudeAnalyzer, CommentPlacement } from '../intelligent-placement/claudeAnalyzer';
import { PreciseCommentInserter } from '../intelligent-placement/preciseInserter';
import { ErrorHandler } from '../utils/errorHandler';
import { ConfigManager } from '../utils/configManager';

/**
 * Hybrid Intelligence Manager
 * 
 * Entscheidet automatisch:
 * - ONLINE: Claude API (wenn verfügbar) → Beste Qualität
 * - OFFLINE: AST-Analyse + Smart Generator → Immer verfügbar
 * 
 * Das Beste aus beiden Welten!
 */
export class HybridIntelligenceManager {
    
    private static mode: 'auto' | 'online-only' | 'offline-only' = 'auto';

    /**
     * Hauptmethode: Intelligent kommentieren (hybrid)
     */
    static async processAndPlace(
        editor: vscode.TextEditor,
        transcribedText: string
    ): Promise<boolean> {
        try {
            const document = editor.document;
            const position = editor.selection.active;

            ErrorHandler.log('HybridManager', '🔄 Starte Hybrid-Intelligence-Analyse');

            // Strategie bestimmen
            const strategy = await this.determineStrategy();
            
            ErrorHandler.log('HybridManager', `📊 Strategie: ${strategy}`);

            let placement: CommentPlacement | null = null;

            if (strategy === 'online') {
                // 🌐 Online-Modus: Claude API
                placement = await this.processOnline(document, position, transcribedText);
            } else {
                // 💻 Offline-Modus: AST-Analyse
                placement = await this.processOffline(document, position, transcribedText);
            }

            if (!placement) {
                vscode.window.showWarningMessage('⚠️ Konnte keine gültige Kommentar-Platzierung ermitteln');
                return false;
            }

            // Validierung
            const validation = await PreciseCommentInserter.validatePlacement(document, placement);
            
            if (!validation.isValid) {
                const errors = validation.errors?.join('\n') || 'Unbekannt';
                vscode.window.showErrorMessage(`❌ Platzierung ungültig:\n${errors}`);
                return false;
            }

            // Einfügen
            const success = await PreciseCommentInserter.insertComment(editor, placement);

            if (success) {
                const modeEmoji = strategy === 'online' ? '🌐' : '💻';
                vscode.window.showInformationMessage(
                    `✅ Kommentar eingefügt! ${modeEmoji} (${strategy === 'online' ? 'Claude AI' : 'Offline AST'})`
                );
            }

            return success;

        } catch (error: any) {
            ErrorHandler.handleError('HybridManager.processAndPlace', error);
            return false;
        }
    }

    /**
     * Bestimmt optimale Strategie (Online vs. Offline)
     */
    private static async determineStrategy(): Promise<'online' | 'offline'> {
        // Nutzer-Einstellung prüfen
        if (this.mode === 'online-only') {
            const available = await ClaudeAnalyzer.isAvailable();
            return available ? 'online' : 'offline'; // Fallback to offline
        }
        
        if (this.mode === 'offline-only') {
            return 'offline';
        }

        // Auto-Modus: Intelligente Entscheidung
        const factors = await this.analyzeStrategyFactors();

        // Entscheidungs-Logik
        if (factors.hasInternetConnection && factors.hasApiKey) {
            if (factors.isComplexCode) {
                return 'online'; // Komplexer Code → Claude ist besser
            }
            if (factors.requiresHighQuality) {
                return 'online'; // High-Quality → Claude
            }
            // Für einfachen Code: Offline ist ausreichend und schneller
            return factors.preferSpeed ? 'offline' : 'online';
        }

        return 'offline'; // Fallback wenn keine API verfügbar
    }

    /**
     * Analysiert Faktoren für Strategie-Entscheidung
     */
    private static async analyzeStrategyFactors(): Promise<StrategyFactors> {
        const hasApiKey = await ClaudeAnalyzer.isAvailable();
        const hasInternetConnection = await this.checkInternetConnection();
        
        // Simplere Checks für andere Faktoren
        const isComplexCode = false; // Könnte basierend auf Datei-Größe bestimmt werden
        const requiresHighQuality = ConfigManager.get<boolean>('useHighQualityMode', false);
        const preferSpeed = ConfigManager.get<boolean>('preferSpeed', false);

        return {
            hasApiKey,
            hasInternetConnection,
            isComplexCode,
            requiresHighQuality,
            preferSpeed
        };
    }

    /**
     * Prüft Internet-Verbindung (einfacher Ping)
     */
    private static async checkInternetConnection(): Promise<boolean> {
        try {
            const axios = require('axios');
            await axios.get('https://www.google.com', { timeout: 2000 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Online-Verarbeitung mit Claude API
     */
    private static async processOnline(
        document: vscode.TextDocument,
        position: vscode.Position,
        transcribedText: string
    ): Promise<CommentPlacement | null> {
        ErrorHandler.log('HybridManager', '🌐 Nutze Online-Modus (Claude API)');

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🧠 Claude analysiert Code...',
            cancellable: false
        }, async () => {
            return await ClaudeAnalyzer.analyzeAndPlaceComment(
                document,
                position.line,
                transcribedText
            );
        });
    }

    /**
     * Offline-Verarbeitung mit AST-Analyse
     */
    private static async processOffline(
        document: vscode.TextDocument,
        position: vscode.Position,
        transcribedText: string
    ): Promise<CommentPlacement | null> {
        ErrorHandler.log('HybridManager', '💻 Nutze Offline-Modus (AST-Analyse)');

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '⚡ AST-Analyse läuft...',
            cancellable: false
        }, async () => {
            try {
                // AST-Analyse
                const structure = ASTCodeAnalyzer.analyzeCodeAtPosition(document, position);

                if (!structure) {
                    ErrorHandler.log('HybridManager', '⚠️ Keine Code-Struktur gefunden, nutze Fallback');
                    return this.createFallbackPlacement(document, position, transcribedText);
                }

                // Intelligente Kommentar-Generierung
                const comment = SmartCommentGenerator.generateComment(
                    structure,
                    transcribedText,
                    document.languageId
                );

                // Finde optimale Position
                const commentPosition = ASTCodeAnalyzer.findCommentPosition(structure);

                const placement: CommentPlacement = {
                    comment: comment,
                    targetLine: commentPosition.line,
                    position: commentPosition.position,
                    indentation: commentPosition.indentation,
                    reasoning: `AST-basiert: ${structure.type} "${structure.name}" erkannt`
                };

                ErrorHandler.log('HybridManager', `✅ Offline-Analyse erfolgreich: ${structure.type}`, 'success');

                return placement;

            } catch (error: any) {
                ErrorHandler.handleError('HybridManager.processOffline', error);
                return this.createFallbackPlacement(document, position, transcribedText);
            }
        });
    }

    /**
     * Erstellt Fallback-Platzierung wenn AST-Analyse fehlschlägt
     */
    private static createFallbackPlacement(
        document: vscode.TextDocument,
        position: vscode.Position,
        transcribedText: string
    ): CommentPlacement {
        const line = document.lineAt(position.line);
        
        // Einfacher Kommentar
        let comment = transcribedText.trim();
        if (!comment.endsWith('.')) {
            comment += '.';
        }
        
        // Sprachspezifische Formatierung
        if (document.languageId === 'python') {
            comment = `# ${comment}`;
        } else {
            comment = `/** ${comment} */`;
        }

        return {
            comment,
            targetLine: position.line,
            position: 'before',
            indentation: line.firstNonWhitespaceCharacterIndex,
            reasoning: 'Fallback-Platzierung (AST-Analyse fehlgeschlagen)'
        };
    }

    /**
     * Setzt Modus manuell
     */
    static setMode(mode: 'auto' | 'online-only' | 'offline-only'): void {
        this.mode = mode;
        ErrorHandler.log('HybridManager', `🔧 Modus geändert auf: ${mode}`, 'success');
        
        vscode.window.showInformationMessage(
            `🔧 Hybrid-Modus: ${mode === 'auto' ? 'Automatisch' : mode === 'online-only' ? 'Nur Online' : 'Nur Offline'}`
        );
    }

    /**
     * Zeigt aktuelle Strategie-Info
     */
    static async showStrategyInfo(): Promise<void> {
        const factors = await this.analyzeStrategyFactors();
        const strategy = await this.determineStrategy();

        const info = [
            '📊 Hybrid Intelligence Status:',
            '',
            `🎯 Aktuelle Strategie: ${strategy === 'online' ? '🌐 Online (Claude)' : '💻 Offline (AST)'}`,
            `⚙️ Modus: ${this.mode}`,
            '',
            'Faktoren:',
            `  ${factors.hasApiKey ? '✅' : '❌'} API-Key vorhanden`,
            `  ${factors.hasInternetConnection ? '✅' : '❌'} Internet-Verbindung`,
            `  ${factors.isComplexCode ? '✅' : '❌'} Komplexer Code`,
            `  ${factors.requiresHighQuality ? '✅' : '❌'} High-Quality Modus`,
            `  ${factors.preferSpeed ? '✅' : '❌'} Speed-Priorität`,
            '',
            '💡 Tipp: Nutze "Voice Doc: Hybrid-Modus ändern" zum Umschalten'
        ].join('\n');

        vscode.window.showInformationMessage(info, { modal: true });
    }

    /**
     * Benchmark: Vergleiche Online vs. Offline
     */
    static async runBenchmark(
        editor: vscode.TextEditor,
        testCases: string[]
    ): Promise<BenchmarkResult> {
        const results: BenchmarkResult = {
            online: { success: 0, failures: 0, avgTime: 0, times: [] },
            offline: { success: 0, failures: 0, avgTime: 0, times: [] }
        };

        for (const testCase of testCases) {
            // Test Online
            const onlineStart = Date.now();
            const onlineSuccess = await this.testOnlineMode(editor, testCase);
            const onlineTime = Date.now() - onlineStart;
            
            if (onlineSuccess) {
                results.online.success++;
            } else {
                results.online.failures++;
            }
            results.online.times.push(onlineTime);

            // Test Offline
            const offlineStart = Date.now();
            const offlineSuccess = await this.testOfflineMode(editor, testCase);
            const offlineTime = Date.now() - offlineStart;
            
            if (offlineSuccess) {
                results.offline.success++;
            } else {
                results.offline.failures++;
            }
            results.offline.times.push(offlineTime);
        }

        // Berechne Durchschnitte
        results.online.avgTime = results.online.times.reduce((a, b) => a + b, 0) / results.online.times.length;
        results.offline.avgTime = results.offline.times.reduce((a, b) => a + b, 0) / results.offline.times.length;

        return results;
    }

    private static async testOnlineMode(editor: vscode.TextEditor, text: string): Promise<boolean> {
        try {
            const placement = await this.processOnline(editor.document, editor.selection.active, text);
            return !!placement;
        } catch {
            return false;
        }
    }

    private static async testOfflineMode(editor: vscode.TextEditor, text: string): Promise<boolean> {
        try {
            const placement = await this.processOffline(editor.document, editor.selection.active, text);
            return !!placement;
        } catch {
            return false;
        }
    }
}

/**
 * Strategie-Faktoren für Entscheidung
 */
interface StrategyFactors {
    hasApiKey: boolean;
    hasInternetConnection: boolean;
    isComplexCode: boolean;
    requiresHighQuality: boolean;
    preferSpeed: boolean;
}

/**
 * Benchmark-Resultat
 */
interface BenchmarkResult {
    online: {
        success: number;
        failures: number;
        avgTime: number;
        times: number[];
    };
    offline: {
        success: number;
        failures: number;
        avgTime: number;
        times: number[];
    };
}
