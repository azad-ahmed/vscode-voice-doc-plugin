import * as vscode from 'vscode';
import { CodeAnalyzer, CodeContext, AnalysisResult } from '../analysis/codeAnalyzer';
import { LearningSystem } from '../learning/learningSystem';
import { ProjectMonitor } from './projectMonitor';
import { IntelligentCommentPlacer } from '../placement/intelligentPlacer';

/**
 * 🔧 VERBESSERTER Auto-Mode Controller mit intelligenter Platzierung
 * 
 * Features:
 * - ✅ ProjectMonitor ist aktiviert
 * - ✅ Intelligente Projekt-Überwachung
 * - ✅ Automatische Erkennung neuer Klassen/Funktionen
 * - ✅ Manuelle Analyse weiterhin möglich
 * - 🆕 INTELLIGENTE KOMMENTAR-PLATZIERUNG mit AST-Analyse
 * - 🆕 Keine doppelten Kommentare an derselben Stelle mehr
 * - 🆕 Kontextbewusste Platzierung basierend auf Code-Struktur
 */
export class AutoModeController {
    private isEnabled: boolean = false;
    private statusBarItem: vscode.StatusBarItem;
    
    private projectMonitor: ProjectMonitor;
    private intelligentPlacer: IntelligentCommentPlacer;

    constructor(
        private codeAnalyzer: CodeAnalyzer,
        private learningSystem: LearningSystem,
        private context: vscode.ExtensionContext
    ) {
        this.projectMonitor = new ProjectMonitor(
            codeAnalyzer,
            learningSystem,
            context
        );
        
        // 🆕 Initialisiere intelligenten Placer
        this.intelligentPlacer = new IntelligentCommentPlacer();
        
        // Status Bar Setup
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            99
        );
        this.statusBarItem.command = 'voiceDocPlugin.toggleAutoMode';
        this.updateStatusBar();
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);

        console.log('✅ AutoModeController mit IntelligentPlacer initialisiert');
    }

    /**
     * Aktiviert Auto-Modus
     */
    async enable(): Promise<void> {
        if (this.isEnabled) {
            vscode.window.showInformationMessage('🤖 Auto-Modus ist bereits aktiviert');
            return;
        }

        this.isEnabled = true;
        
        this.projectMonitor.start();
        
        this.updateStatusBar();
        
        vscode.window.showInformationMessage(
            '✅ Auto-Modus aktiviert!\n\n' +
            '👁️ Überwacht GESAMTES Projekt\n' +
            '🆕 Erkennt neue Klassen/Funktionen automatisch\n' +
            '📝 Schlägt intelligente Dokumentation vor\n' +
            '🧠 Lernt aus deinem Feedback\n' +
            '🎯 Intelligente Kommentar-Platzierung mit AST\n\n' +
            '💡 Intelligente Überwachung läuft im Hintergrund!',
            'Details'
        ).then(action => {
            if (action === 'Details') {
                this.showAutoModeInfo();
            }
        });
        
        console.log('✅ Auto-Modus aktiviert - ProjectMonitor gestartet');
    }

    /**
     * Deaktiviert Auto-Modus
     */
    disable(): void {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        
        this.projectMonitor.stop();
        
        this.updateStatusBar();
        
        const stats = this.projectMonitor.getStatistics();
        vscode.window.showInformationMessage(
            `Auto-Modus deaktiviert\n\n` +
            `📊 Statistik:\n` +
            `- ${stats.totalDetections} Elemente erkannt\n` +
            `- ${stats.documentsProcessed} Dateien analysiert\n` +
            `- ${stats.suggestionsAccepted} Vorschläge akzeptiert`
        );
        
        console.log('⏹️ Auto-Modus deaktiviert - ProjectMonitor gestoppt');
    }

    /**
     * Wechselt Auto-Mode an/aus
     */
    async toggle(): Promise<void> {
        if (this.isEnabled) {
            this.disable();
        } else {
            await this.enable();
        }
    }

    /**
     * Aktiviert Auto-Mode direkt (ohne Bestätigung) - für Startup
     */
    enableDirect(): void {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.projectMonitor.start();
        this.updateStatusBar();
        
        console.log('✅ Auto-Modus direkt aktiviert');
    }

    /**
     * Gibt zurück ob Auto-Mode aktiviert ist
     */
    isActive(): boolean {
        return this.isEnabled;
    }

    /**
     * Aktualisiert Status Bar Item
     */
    private updateStatusBar(): void {
        if (this.isEnabled) {
            this.statusBarItem.text = '$(eye) Auto-Doc: ON';
            this.statusBarItem.tooltip = 'Auto-Dokumentation ist aktiv\nKlicke um zu deaktivieren';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            this.statusBarItem.text = '$(eye-closed) Auto-Doc: OFF';
            this.statusBarItem.tooltip = 'Auto-Dokumentation ist inaktiv\nKlicke um zu aktivieren';
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    /**
     * Analysiert aktuelle Funktion
     */
    async analyzeCurrentFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('❌ Kein aktiver Editor');
            return;
        }

        const position = editor.selection.active;
        const codeContext = this.getCodeContext(editor, position);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `🔍 Analysiere "${codeContext.functionName}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 30, message: 'Code-Analyse...' });
                
                const analysis = await this.codeAnalyzer.analyzeCode(codeContext);
                
                progress.report({ increment: 40, message: 'Vorschlag erstellen...' });
                
                await this.suggestDocumentation(analysis, position, codeContext, editor);
                
                progress.report({ increment: 30, message: 'Fertig!' });
                
            } catch (error) {
                vscode.window.showErrorMessage(
                    `❌ Analyse fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
                );
                console.error('Analyse Error:', error);
            }
        });
    }

    /**
     * Zeigt Auto-Mode Informationen
     */
    private async showAutoModeInfo(): Promise<void> {
        const stats = this.projectMonitor.getStatistics();
        
        const panel = vscode.window.createWebviewPanel(
            'autoModeInfo',
            '👁️ Auto-Modus Information',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateInfoHTML(stats);
    }

    /**
     * Generiert Info HTML
     */
    private generateInfoHTML(stats: any): string {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
.info-card { background: var(--vscode-editor-inactiveSelectionBackground); border-left: 4px solid var(--vscode-activityBar-activeBorder); padding: 15px; margin: 10px 0; border-radius: 4px; }
.stat { font-size: 24px; font-weight: bold; color: var(--vscode-activityBar-activeBorder); }
h1 { color: var(--vscode-activityBar-activeBorder); }
h3 { margin-top: 20px; }
.feature-new { color: #4CAF50; font-weight: bold; }
</style>
</head>
<body>
<h1>👁️ Auto-Modus - Intelligente Projekt-Überwachung</h1>
<div class="info-card">
<h3>Was macht der Auto-Modus?</h3>
<ul>
<li>✅ Überwacht ALLE Dateien im Projekt automatisch</li>
<li>✅ Erkennt neue Klassen und Funktionen sofort</li>
<li>✅ Analysiert Code mit KI (GPT-4/Claude)</li>
<li>✅ Schlägt intelligente Dokumentation vor</li>
<li>✅ Lernt aus deinem Feedback</li>
<li class="feature-new">🆕 Intelligente Kommentar-Platzierung mit AST-Analyse</li>
<li class="feature-new">🆕 Verhindert doppelte Kommentare</li>
<li class="feature-new">🆕 Kontextbewusste Platzierung</li>
</ul>
</div>
<div class="info-card">
<h3>📊 Aktuelle Statistik</h3>
<p>Elemente erkannt: <span class="stat">${stats.totalDetections}</span></p>
<p>Dateien verarbeitet: <span class="stat">${stats.documentsProcessed}</span></p>
<p>Vorschläge akzeptiert: <span class="stat">${stats.suggestionsAccepted}</span></p>
<p>Aktive Überwachung: <span class="stat">${stats.isMonitoring ? '✅ JA' : '❌ NEIN'}</span></p>
</div>
</body>
</html>`;
    }

    /**
     * Holt Code-Context
     * ✅ FIXED: Verwendet korrekte CodeContext Properties
     */
    private getCodeContext(editor: vscode.TextEditor, position: vscode.Position): CodeContext {
        const document = editor.document;
        const functionInfo = this.findNearestFunction(document, position);
        
        const linesBefore = Math.max(0, position.line - 10);
        const linesAfter = Math.min(document.lineCount, position.line + 10);
        
        let context = '';
        for (let i = linesBefore; i < linesAfter; i++) {
            context += document.lineAt(i).text + '\n';
        }
        
        return {
            code: context,
            line: position.line + 1,
            languageId: document.languageId,
            functionName: functionInfo.name,
            functionType: functionInfo.type
        };
    }

    /**
     * Findet nächste Funktion
     */
    private findNearestFunction(document: vscode.TextDocument, position: vscode.Position): any {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        const functionRegex = /(?:function|const|let|var|async|def)\s+(\w+)\s*[=(]/g;
        const classRegex = /class\s+(\w+)/g;
        const methodRegex = /(\w+)\s*\([^)]*\)\s*[:{]/g;
        
        let match;
        let closestFunction: any = { name: 'unknown', type: 'code', distance: Infinity };
        
        while ((match = functionRegex.exec(text)) !== null) {
            const distance = Math.abs(match.index - offset);
            if (distance < closestFunction.distance && match.index < offset) {
                closestFunction = { name: match[1], type: 'function', distance: distance };
            }
        }
        
        while ((match = classRegex.exec(text)) !== null) {
            const distance = Math.abs(match.index - offset);
            if (distance < closestFunction.distance && match.index < offset) {
                closestFunction = { name: match[1], type: 'class', distance: distance };
            }
        }
        
        while ((match = methodRegex.exec(text)) !== null) {
            const distance = Math.abs(match.index - offset);
            if (distance < closestFunction.distance && match.index < offset) {
                closestFunction = { name: match[1], type: 'method', distance: distance };
            }
        }
        
        return closestFunction;
    }

    private async suggestDocumentation(analysis: AnalysisResult, position: vscode.Position, codeContext: CodeContext, editor: vscode.TextEditor): Promise<void> {
        const confidencePercent = Math.round(analysis.confidence * 100);
        const confidenceEmoji = confidencePercent >= 80 ? '🟢' : confidencePercent >= 60 ? '🟡' : '🔴';
        
        const action = await vscode.window.showInformationMessage(
            `📝 Dokumentation für "${codeContext.functionName}"\n${confidenceEmoji} Konfidenz: ${confidencePercent}%\n🎯 Intelligente Platzierung wird verwendet`,
            { modal: false }, 'Einfügen', 'Bearbeiten', 'Preview', 'Ignorieren'
        );

        if (action === 'Preview') {
            await vscode.window.showInformationMessage(
                `📖 Preview:\n\n${analysis.description}`, 'Einfügen', 'Bearbeiten', 'Abbrechen'
            ).then(async (previewAction) => {
                if (previewAction === 'Einfügen') {
                    await this.insertDocumentationIntelligently(analysis, position, codeContext, editor);
                } else if (previewAction === 'Bearbeiten') {
                    await this.editAndInsertDocumentationIntelligently(analysis, position, codeContext, editor);
                }
            });
        } else if (action === 'Einfügen') {
            await this.insertDocumentationIntelligently(analysis, position, codeContext, editor);
        } else if (action === 'Bearbeiten') {
            await this.editAndInsertDocumentationIntelligently(analysis, position, codeContext, editor);
        } else {
            this.learningSystem.addTrainingExample({
                input: analysis.description, output: '', codeContext: codeContext,
                source: 'auto', accepted: false, confidence: analysis.confidence, timestamp: Date.now()
            });
        }
    }

    private async insertDocumentationIntelligently(analysis: AnalysisResult, position: vscode.Position, codeContext: CodeContext, editor: vscode.TextEditor): Promise<void> {
        const comment = analysis.description;
        const success = await this.intelligentPlacer.placeCommentIntelligently(editor, comment, position);

        if (success) {
            this.learningSystem.addTrainingExample({
                input: analysis.description, output: comment, codeContext: codeContext,
                source: 'auto', accepted: true, confidence: analysis.confidence, timestamp: Date.now()
            });
            vscode.window.showInformationMessage(`✅ Dokumentation für "${codeContext.functionName}" intelligent eingefügt!`);
        } else {
            vscode.window.showWarningMessage(`⚠️ Kommentar konnte nicht eingefügt werden`);
        }
    }

    private async editAndInsertDocumentationIntelligently(analysis: AnalysisResult, position: vscode.Position, codeContext: CodeContext, editor: vscode.TextEditor): Promise<void> {
        const edited = await vscode.window.showInputBox({
            prompt: 'Dokumentation bearbeiten', value: analysis.description,
            placeHolder: 'Ihre Dokumentation...', ignoreFocusOut: true
        });

        if (edited) {
            const success = await this.intelligentPlacer.placeCommentIntelligently(editor, edited, position);
            if (success) {
                this.learningSystem.addTrainingExample({
                    input: analysis.description, output: edited, codeContext: codeContext,
                    source: 'auto', accepted: true, edited: true, originalSuggestion: analysis.description,
                    confidence: analysis.confidence, timestamp: Date.now()
                });
                vscode.window.showInformationMessage(`✅ Bearbeitete Dokumentation für "${codeContext.functionName}" intelligent eingefügt!`);
            } else {
                vscode.window.showWarningMessage(`⚠️ Kommentar konnte nicht eingefügt werden`);
            }
        }
    }

    private async insertDocumentation(analysis: AnalysisResult, position: vscode.Position, codeContext: CodeContext, editor: vscode.TextEditor): Promise<void> {
        console.warn('⚠️ insertDocumentation() ist veraltet - nutze insertDocumentationIntelligently()');
        await this.insertDocumentationIntelligently(analysis, position, codeContext, editor);
    }

    private async editAndInsertDocumentation(analysis: AnalysisResult, position: vscode.Position, codeContext: CodeContext, editor: vscode.TextEditor): Promise<void> {
        console.warn('⚠️ editAndInsertDocumentation() ist veraltet - nutze editAndInsertDocumentationIntelligently()');
        await this.editAndInsertDocumentationIntelligently(analysis, position, codeContext, editor);
    }

    private formatComment(text: string, languageId: string): string {
        switch (languageId) {
            case 'python': return `"""\n${text}\n"""`;
            case 'javascript':
            case 'typescript':
            case 'java':
            case 'csharp': return `/**\n * ${text}\n */`;
            case 'go':
            case 'rust': return `// ${text}`;
            default: return `/**\n * ${text}\n */`;
        }
    }

    private getMinConfidence(): number {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        return config.get('minConfidence', 0.7);
    }

    dispose(): void {
        if (this.isEnabled) {
            const stats = this.projectMonitor.getStatistics();
            console.log('📊 Auto-Modus Statistik bei Cleanup:', stats);
        }
        this.disable();
        this.projectMonitor.dispose();
        this.statusBarItem.dispose();
        console.log('✅ AutoModeController disposed');
    }

    async enableProjectMode(): Promise<void> {
        await this.enable();
    }

    disableProjectMode(): void {
        this.disable();
    }

    async toggleProjectMode(): Promise<void> {
        await this.toggle();
    }
}
