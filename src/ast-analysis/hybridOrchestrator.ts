import * as vscode from 'vscode';
import { ClaudeAnalyzer } from '../intelligent-placement/claudeAnalyzer';
import { SmartOfflinePlacer, ContextAnalysis } from './smartOfflinePlacer';
import { OfflineCodeAnalyzer } from './offlineAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';
import { ConfigManager } from '../utils/configManager';

/**
 * Hybrid-Orchestrator: Online + Offline Intelligenz
 * 
 * STRATEGIE:
 * 1. OFFLINE ZUERST: Analysiere Code-Struktur lokal (schnell!)
 * 2. ONLINE FÜR TEXT: Dienst verbessert Text (OpenAI, Azure)
 * 3. OFFLINE PLATZIERUNG: Lokale Intelligenz platziert
 * 
 * VORTEILE:
 * - Funktioniert auch OFFLINE
 * - Schneller (keine API-Calls für Platzierung)
 * - Dienst nur für Text-Verbesserung
 * - Code-Analyse bleibt lokal (Privacy!)
 */
export class HybridIntelligenceOrchestrator {

    /**
     * Hauptmethode: Intelligente Platzierung mit Hybrid-Ansatz
     */
    static async processAndPlace(
        editor: vscode.TextEditor,
        rawText: string
    ): Promise<HybridResult> {
        try {
            ErrorHandler.log('HybridOrchestrator', '🔄 Starte Hybrid-Verarbeitung...');

            const document = editor.document;
            const position = editor.selection.active;

            // ===== PHASE 1: OFFLINE Code-Analyse (immer!) =====
            ErrorHandler.log('HybridOrchestrator', '📊 Phase 1: Offline Code-Analyse');
            
            const startTime = Date.now();
            const structure = await OfflineCodeAnalyzer.analyzeCodeStructure(document, position);
            const analyzeTime = Date.now() - startTime;
            
            ErrorHandler.log('HybridOrchestrator', 
                `✅ Struktur erkannt in ${analyzeTime}ms: ${structure.type} "${structure.name}" (${Math.round(structure.confidence * 100)}% Konfidenz)`
            );

            // ===== PHASE 2: Text-Verbesserung (optional, online) =====
            ErrorHandler.log('HybridOrchestrator', '✨ Phase 2: Text-Verbesserung');
            
            let enhancedText = rawText;
            let textSource = 'original';
            
            const mode = await this.determineProcessingMode();
            
            if (mode === 'hybrid' || mode === 'online') {
                // Versuche Text-Verbesserung über Dienst
                const improvedText = await this.enhanceTextWithService(
                    rawText,
                    structure,
                    document
                );
                
                if (improvedText) {
                    enhancedText = improvedText;
                    textSource = 'enhanced';
                    ErrorHandler.log('HybridOrchestrator', '✅ Text erfolgreich verbessert');
                } else {
                    ErrorHandler.log('HybridOrchestrator', '⚠️ Text-Verbesserung fehlgeschlagen, nutze Original');
                }
            } else {
                ErrorHandler.log('HybridOrchestrator', '📴 Offline-Modus: Keine Text-Verbesserung');
            }

            // ===== PHASE 3: Intelligente Platzierung (immer offline!) =====
            ErrorHandler.log('HybridOrchestrator', '🎯 Phase 3: Intelligente Platzierung');
            
            const placementResult = await SmartOfflinePlacer.placeCommentIntelligently(
                editor,
                enhancedText,
                position
            );

            if (placementResult.success) {
                ErrorHandler.log('HybridOrchestrator', '✅ Hybrid-Verarbeitung erfolgreich!', 'success');
                
                // Zeige Erfolgs-Statistik
                this.showSuccessMessage(structure, textSource, mode, analyzeTime);
                
                return {
                    success: true,
                    mode: mode,
                    structure: structure,
                    textSource: textSource,
                    analyzeTimeMs: analyzeTime
                };
            } else {
                ErrorHandler.log('HybridOrchestrator', `❌ Platzierung fehlgeschlagen: ${placementResult.reason}`);
                
                return {
                    success: false,
                    mode: mode,
                    error: placementResult.reason
                };
            }

        } catch (error: any) {
            ErrorHandler.handleError('HybridOrchestrator.processAndPlace', error);
            
            return {
                success: false,
                mode: 'offline',
                error: error.message
            };
        }
    }

    /**
     * Bestimmt Verarbeitungs-Modus
     */
    private static async determineProcessingMode(): Promise<ProcessingMode> {
        // Prüfe ob Internet-Verbindung verfügbar
        const hasInternet = await this.checkInternetConnection();
        
        if (!hasInternet) {
            ErrorHandler.log('HybridOrchestrator', '📴 Keine Internet-Verbindung → Offline-Modus');
            return 'offline';
        }

        // Prüfe ob API-Key vorhanden
        const hasApiKey = await ClaudeAnalyzer.isAvailable();
        
        if (!hasApiKey) {
            ErrorHandler.log('HybridOrchestrator', '🔑 Kein API-Key → Offline-Modus');
            return 'offline';
        }

        // Prüfe User-Präferenz
        const userPreference = ConfigManager.get<string>('processingMode', 'hybrid');
        
        if (userPreference === 'offline-only') {
            ErrorHandler.log('HybridOrchestrator', '⚙️ User-Einstellung: Offline-Only');
            return 'offline';
        }

        ErrorHandler.log('HybridOrchestrator', '🔄 Hybrid-Modus aktiviert');
        return 'hybrid';
    }

    /**
     * Prüft Internet-Verbindung (einfacher Check)
     */
    private static async checkInternetConnection(): Promise<boolean> {
        try {
            // Schneller Check: DNS-Auflösung
            const dns = require('dns');
            return new Promise((resolve) => {
                dns.resolve('www.google.com', (err: any) => {
                    resolve(!err);
                });
            });
        } catch {
            return false;
        }
    }

    /**
     * Verbessert Text mit Online-Dienst
     */
    private static async enhanceTextWithService(
        rawText: string,
        structure: any,
        document: vscode.TextDocument
    ): Promise<string | null> {
        try {
            // Nutze OpenAI/Azure für Text-Verbesserung (NICHT für Platzierung!)
            const apiKey = await ConfigManager.getSecret('openAIApiKey');
            
            if (!apiKey) {
                return null;
            }

            // Vereinfachter Prompt NUR für Text-Verbesserung
            const prompt = this.buildTextEnhancementPrompt(rawText, structure, document.languageId);
            
            // API-Call (mit Timeout)
            const axios = require('axios');
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 500,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: 5000 // 5 Sekunden Timeout
                }
            );

            const enhancedText = response.data.content[0].text.trim();
            return enhancedText;

        } catch (error) {
            ErrorHandler.log('HybridOrchestrator', 'Text-Verbesserung fehlgeschlagen');
            return null;
        }
    }

    /**
     * Baut Prompt NUR für Text-Verbesserung
     */
    private static buildTextEnhancementPrompt(
        rawText: string,
        structure: any,
        languageId: string
    ): string {
        return `Verbessere folgenden Dokumentations-Text für einen ${structure.type} in ${languageId}:

"${rawText}"

AUFGABE:
- Formuliere professionell und präzise
- Nutze korrekte technische Begriffe
- Halte es kurz und klar
- NUR der verbesserte Text, KEINE zusätzlichen Erklärungen

AUSGABE (nur Text):`;
    }

    /**
     * Zeigt Erfolgs-Nachricht
     */
    private static showSuccessMessage(
        structure: any,
        textSource: string,
        mode: ProcessingMode,
        analyzeTime: number
    ): void {
        const modeIcon = {
            'offline': '📴 Offline',
            'hybrid': '🔄 Hybrid',
            'online': '☁️ Online'
        };

        const textIcon = textSource === 'enhanced' ? '✨ Verbessert' : '📝 Original';

        vscode.window.showInformationMessage(
            `✅ Kommentar eingefügt!\n` +
            `📊 ${structure.type} "${structure.name}"\n` +
            `${modeIcon[mode]} | ${textIcon} | ⚡ ${analyzeTime}ms`
        );
    }

    /**
     * Nur Analyse, kein Einfügen (für Testing)
     */
    static async analyzeOnly(
        editor: vscode.TextEditor,
        rawText: string
    ): Promise<AnalysisPreview> {
        try {
            const document = editor.document;
            const position = editor.selection.active;

            // Analysiere Struktur
            const structure = await OfflineCodeAnalyzer.analyzeCodeStructure(document, position);
            
            // Analysiere Kontext
            const context = await SmartOfflinePlacer.analyzeContext(document, position);

            // Zeige Analyse
            const preview = this.generateAnalysisPreview(structure, context, rawText);
            
            vscode.window.showInformationMessage(preview, { modal: true });

            return {
                structure: structure,
                context: context,
                recommendedText: rawText
            };

        } catch (error: any) {
            ErrorHandler.handleError('HybridOrchestrator.analyzeOnly', error);
            throw error;
        }
    }

    /**
     * Generiert Analyse-Preview
     */
    private static generateAnalysisPreview(
        structure: any,
        context: any,
        text: string
    ): string {
        return [
            `🔍 CODE-STRUKTUR-ANALYSE`,
            ``,
            `📊 Erkannt:`,
            `  Typ: ${structure.type}`,
            `  Name: "${structure.name}"`,
            `  Zeile: ${structure.startLine}`,
            `  Einrückung: ${structure.indentation} Leerzeichen`,
            `  Konfidenz: ${Math.round(structure.confidence * 100)}%`,
            ``,
            `💬 Kommentar:`,
            `"${text}"`,
            ``,
            `📍 Platzierung:`,
            `  Position: ${structure.insertPosition === 'before' ? 'VOR' : 'NACH'} Zeile ${structure.insertLine}`,
            `  Sprache: ${context.languageId}`,
            `  Vorhandene Kommentare: ${context.hasExistingComments ? 'Ja' : 'Nein'}`,
            ``,
            `✅ Bereit zum Einfügen!`
        ].join('\n');
    }

    /**
     * Batch-Verarbeitung mehrerer Kommentare
     */
    static async batchProcess(
        editor: vscode.TextEditor,
        items: Array<{ text: string, line: number }>
    ): Promise<BatchResult> {
        let successCount = 0;
        let failCount = 0;
        const results: Array<{ line: number, success: boolean, reason?: string }> = [];

        for (const item of items) {
            // Setze Cursor
            const position = new vscode.Position(item.line, 0);
            editor.selection = new vscode.Selection(position, position);

            const result = await this.processAndPlace(editor, item.text);
            
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }

            results.push({
                line: item.line,
                success: result.success,
                reason: result.error
            });

            // Kurze Pause
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        vscode.window.showInformationMessage(
            `✅ Batch-Verarbeitung abgeschlossen!\n` +
            `Erfolgreich: ${successCount} | Fehlgeschlagen: ${failCount}`
        );

        return {
            total: items.length,
            successful: successCount,
            failed: failCount,
            details: results
        };
    }
}

/**
 * Verarbeitungs-Modi
 */
type ProcessingMode = 'offline' | 'hybrid' | 'online';

/**
 * Hybrid-Resultat
 */
export interface HybridResult {
    success: boolean;
    mode: ProcessingMode;
    structure?: any;
    textSource?: string;
    analyzeTimeMs?: number;
    error?: string;
}

/**
 * Analyse-Preview
 */
interface AnalysisPreview {
    structure: any;
    context: ContextAnalysis;
    recommendedText: string;
}

/**
 * Batch-Resultat
 */
interface BatchResult {
    total: number;
    successful: number;
    failed: number;
    details: Array<{ line: number, success: boolean, reason?: string }>;
}
