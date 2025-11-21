import * as vscode from 'vscode';
import { CodeAnalyzer } from '../analysis/codeAnalyzer';
import { CodeElement } from '../types/codeAnalysis';
import { CommentGenerator } from '../generator';
import { ErrorHandler } from './errorHandler';
import { ConfigManager } from './configManager';
import { LearningSystem } from '../learning/learningSystem';
import { PositionValidator } from '../intelligent-placement/positionValidator';

/**
 * Intelligenter Auto-Comment Monitor
 * 
 * ✨ INTELLIGENTE KOMMENTARE:
 * - Analysiert Code automatisch beim Speichern
 * - Generiert hochwertige KI-Kommentare mit Kontext
 * - Vermeidet Duplikate intelligent
 * - Nur einmalige Dokumentation pro Element
 */
export class AutoCommentMonitor {
    private analyzer: CodeAnalyzer | null = null;
    private generator: CommentGenerator;
    private documentChangeListener?: vscode.Disposable;
    private documentSaveListener?: vscode.Disposable;
    private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
    
    // Tracking für bereits dokumentierte Elemente
    private documentedElements: Map<string, Set<string>> = new Map(); // URI -> Set<"className.methodName">
    private lastProcessedHash: Map<string, string> = new Map(); // URI -> content hash
    private runningAnalyses: Set<string> = new Set();

    constructor(
        generator: CommentGenerator,
        learningSystem?: LearningSystem
    ) {
        this.generator = generator;
        
        if (learningSystem) {
            this.analyzer = new CodeAnalyzer(learningSystem);
        }
    }

    /**
     * Startet die Code-Überwachung
     */
    public start(): void {
        if (this.documentChangeListener) {
            return;
        }

        ErrorHandler.log('AutoCommentMonitor', '🚀 Starte intelligente Auto-Kommentierung');

        this.documentSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
            await this.onDocumentSaved(document);
        });

        ErrorHandler.log('AutoCommentMonitor', 'Intelligente Kommentierung aktiv', 'success');
    }

    /**
     * Stoppt die Code-Überwachung
     */
    public stop(): void {
        if (this.documentChangeListener) {
            this.documentChangeListener.dispose();
            this.documentChangeListener = undefined;
        }

        if (this.documentSaveListener) {
            this.documentSaveListener.dispose();
            this.documentSaveListener = undefined;
        }

        this.pendingChanges.forEach(timer => clearTimeout(timer));
        this.pendingChanges.clear();

        ErrorHandler.log('AutoCommentMonitor', 'Auto-Kommentierung gestoppt');
    }

    /**
     * Wird aufgerufen wenn ein Dokument gespeichert wird
     */
    private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
        const mode = ConfigManager.get<string>('autoCommentMode', 'off');
        
        if (mode === 'off' || !this.shouldProcessDocument(document)) {
            return;
        }

        const uri = document.uri.toString();
        
        // Verhindere parallele Analysen
        if (this.runningAnalyses.has(uri)) {
            return;
        }

        try {
            this.runningAnalyses.add(uri);
            await this.analyzeAndComment(document);
        } catch (error) {
            ErrorHandler.handleError('AutoCommentMonitor.onDocumentSaved', error, false);
        } finally {
            this.runningAnalyses.delete(uri);
        }
    }

    /**
     * Prüft ob ein Dokument verarbeitet werden soll
     */
    private shouldProcessDocument(document: vscode.TextDocument): boolean {
        const supportedLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
        
        if (!supportedLanguages.includes(document.languageId)) {
            return false;
        }

        if (document.uri.scheme !== 'file') {
            return false;
        }

        if (document.fileName.includes('node_modules')) {
            return false;
        }

        return true;
    }

    /**
     * Analysiert Dokument und fügt intelligente Kommentare hinzu
     */
    private async analyzeAndComment(document: vscode.TextDocument): Promise<void> {
        const uri = document.uri.toString();
        const content = document.getText();
        
        // Hash berechnen (ohne Kommentare)
        const contentHash = this.hashCode(content);
        const lastHash = this.lastProcessedHash.get(uri);
        
        // Wenn sich nichts geändert hat, nicht nochmal analysieren
        if (lastHash === contentHash) {
            return;
        }

        const elements = this.analyzeCode(content, document.languageId);
        
        // Filter: Nur undokumentierte Elemente
        const uncommentedElements = this.filterUndocumented(elements, document, uri);

        if (uncommentedElements.length === 0) {
            this.lastProcessedHash.set(uri, contentHash);
            return;
        }

        ErrorHandler.log(
            'AutoCommentMonitor',
            `📝 ${uncommentedElements.length} neue undokumentierte Elemente gefunden`
        );

        const minComplexity = ConfigManager.get<number>('autoCommentMinComplexity', 5) || 5;
        const elementsToComment = uncommentedElements.filter((el: CodeElement) => 
            (el.complexity || 0) >= minComplexity
        );

        if (elementsToComment.length === 0) {
            this.lastProcessedHash.set(uri, contentHash);
            return;
        }

        // Max 5 Elemente pro Durchlauf
        const limitedElements = elementsToComment.slice(0, 5);
        
        // Frage Benutzer (außer wenn autoApprove)
        const autoApprove = ConfigManager.get<boolean>('autoCommentAutoApprove', false);
        
        if (!autoApprove) {
            const action = await vscode.window.showInformationMessage(
                `🤖 ${limitedElements.length} neue Code-Elemente gefunden.\n\n` +
                `Intelligente Kommentare generieren?`,
                'Ja, alle',
                'Einzeln durchgehen',
                'Nein'
            );

            if (action === 'Einzeln durchgehen') {
                await this.reviewElements(document, limitedElements);
            } else if (action === 'Ja, alle') {
                await this.commentAllElements(document, limitedElements);
            }
        } else {
            await this.commentAllElements(document, limitedElements);
        }

        // Update Hash nach erfolgreicher Verarbeitung
        this.lastProcessedHash.set(uri, this.hashCode(document.getText()));
    }

    /**
     * Analysiert Code und findet Elemente
     */
    private analyzeCode(content: string, languageId: string): CodeElement[] {
        const elements: CodeElement[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Klassen
            const classMatch = line.match(/^\s*(export\s+)?class\s+(\w+)/);
            if (classMatch) {
                elements.push({
                    type: 'class',
                    name: classMatch[2],
                    startLine: i,
                    endLine: i,
                    complexity: 10
                });
            }

            // Funktionen
            const funcMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+(\w+)/);
            if (funcMatch) {
                elements.push({
                    type: 'function',
                    name: funcMatch[3],
                    startLine: i,
                    endLine: i,
                    complexity: 8
                });
            }

            // Methoden (innerhalb Klassen)
            const methodMatch = line.match(/^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\(/);
            if (methodMatch && !funcMatch && !classMatch) {
                // Finde umgebende Klasse
                let className = 'Unknown';
                for (let j = i - 1; j >= 0; j--) {
                    const classLine = lines[j].match(/class\s+(\w+)/);
                    if (classLine) {
                        className = classLine[1];
                        break;
                    }
                }
                
                elements.push({
                    type: 'method',
                    name: `${className}.${methodMatch[3]}`,
                    startLine: i,
                    endLine: i,
                    complexity: 7
                });
            }
        }

        return elements;
    }

    /**
     * Filtert bereits dokumentierte Elemente
     */
    private filterUndocumented(
        elements: CodeElement[],
        document: vscode.TextDocument,
        uri: string
    ): CodeElement[] {
        const documented = this.documentedElements.get(uri) || new Set();
        
        return elements.filter(el => {
            // Bereits als dokumentiert markiert?
            if (documented.has(el.name)) {
                return false;
            }
            
            // Prüfe ob Kommentar in den 5 Zeilen darüber
            for (let i = Math.max(0, el.startLine - 5); i < el.startLine; i++) {
                const line = document.lineAt(i).text;
                if (line.includes('/**') || line.includes('//') || line.includes('/*')) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * Kommentiert alle Elemente mit intelligenten KI-Kommentaren
     */
    private async commentAllElements(
        document: vscode.TextDocument, 
        elements: CodeElement[]
    ): Promise<void> {
        const editor = await vscode.window.showTextDocument(document);
        const uri = document.uri.toString();
        let successCount = 0;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🤖 Generiere intelligente Kommentare...',
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                progress.report({
                    message: `${i + 1}/${elements.length}: ${element.name}`,
                    increment: (100 / elements.length)
                });

                try {
                    // Generiere INTELLIGENTEN Kommentar
                    const comment = await this.generateIntelligentComment(element, document);
                    const position = new vscode.Position(element.startLine, 0);
                    await this.insertComment(editor, position, comment);
                    
                    // Markiere als dokumentiert
                    const documented = this.documentedElements.get(uri) || new Set();
                    documented.add(element.name);
                    this.documentedElements.set(uri, documented);
                    
                    successCount++;
                    await this.delay(300);
                } catch (error) {
                    ErrorHandler.handleError('AutoCommentMonitor.comment', error, false);
                }
            }
        });

        if (successCount > 0) {
            vscode.window.showInformationMessage(
                `✅ ${successCount} intelligente Kommentare hinzugefügt!`
            );
        }

        ErrorHandler.log('AutoCommentMonitor', `✅ ${successCount}/${elements.length} Kommentare`, 'success');
    }

    /**
     * Generiert INTELLIGENTEN Kommentar mit KI
     */
    private async generateIntelligentComment(
        element: CodeElement,
        document: vscode.TextDocument
    ): Promise<string> {
        // Check ob OpenAI verfügbar
        if (!this.generator.isOpenAIAvailable()) {
            ErrorHandler.log('AutoCommentMonitor', '⚠️ OpenAI nicht verfügbar - nutze Basic-Kommentar');
            return this.generateBasicComment(element);
        }

        try {
            // Hole erweiterten Code-Kontext (15 Zeilen)
            const startLine = Math.max(0, element.startLine - 5);
            const endLine = Math.min(document.lineCount - 1, element.startLine + 20);
            const codeContext = document.getText(
                new vscode.Range(startLine, 0, endLine, 0)
            );

            // INTELLIGENTER Prompt
            const prompt = this.buildSmartPrompt(element, codeContext);
            
            // KI-Anfrage (mit Timeout)
            const aiComment = await Promise.race([
                this.generator.enhanceWithOpenAI(prompt, null),
                this.timeout(15000)
            ]);
            
            // Formatiere als JSDoc
            return this.generator.formatComment(aiComment.trim(), document.languageId);
            
        } catch (error) {
            ErrorHandler.log('AutoCommentMonitor', `KI-Fehler für ${element.name}`);
            return this.generateBasicComment(element);
        }
    }

    /**
     * Baut SMARTEN Prompt für bessere Kommentare
     */
    private buildSmartPrompt(element: CodeElement, codeContext: string): string {
        const basePrompt = `Analysiere diesen Code und beschreibe präzise was er macht.

Code:
\`\`\`
${codeContext}
\`\`\`

Erstelle einen präzisen, professionellen JSDoc-Kommentar auf Deutsch der:
1. Die Hauptfunktion beschreibt (1-2 Sätze)
2. Wichtige Parameter erklärt (falls vorhanden)
3. Return-Wert erklärt (falls vorhanden)
4. Besonderheiten erwähnt (async, error handling, etc.)

Antworte NUR mit dem Kommentar-Text, OHNE Code, OHNE Markdown-Formatierung.`;

        return basePrompt;
    }

    /**
     * Fallback: Basic-Kommentar ohne KI
     */
    private generateBasicComment(element: CodeElement): string {
        const descriptions: Record<string, string> = {
            'class': `Klasse ${element.name.split('.').pop()}`,
            'function': `Funktion ${element.name}`,
            'method': `Methode ${element.name.split('.').pop()}`
        };

        return this.generator.formatComment(
            descriptions[element.type] || element.name,
            'typescript'
        );
    }

    /**
     * Einzeldurchgang mit Preview
     */
    private async reviewElements(
        document: vscode.TextDocument,
        elements: CodeElement[]
    ): Promise<void> {
        const editor = await vscode.window.showTextDocument(document);
        const uri = document.uri.toString();

        for (const element of elements) {
            const position = new vscode.Position(element.startLine, 0);
            
            // Springe zum Element
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            try {
                const comment = await this.generateIntelligentComment(element, document);
                
                const action = await vscode.window.showInformationMessage(
                    `📝 ${element.type}: "${element.name.split('.').pop()}"\n\n${comment}\n\nHinzufügen?`,
                    { modal: true },
                    'Ja',
                    'Bearbeiten',
                    'Überspringen',
                    'Abbrechen'
                );

                if (action === 'Ja') {
                    await this.insertComment(editor, position, comment);
                    const documented = this.documentedElements.get(uri) || new Set();
                    documented.add(element.name);
                    this.documentedElements.set(uri, documented);
                } else if (action === 'Bearbeiten') {
                    const edited = await vscode.window.showInputBox({
                        prompt: 'Kommentar bearbeiten',
                        value: comment,
                        ignoreFocusOut: true
                    });
                    if (edited) {
                        await this.insertComment(editor, position, edited);
                        const documented = this.documentedElements.get(uri) || new Set();
                        documented.add(element.name);
                        this.documentedElements.set(uri, documented);
                    }
                } else if (action === 'Überspringen') {
                    const documented = this.documentedElements.get(uri) || new Set();
                    documented.add(element.name);
                    this.documentedElements.set(uri, documented);
                } else {
                    break;
                }
            } catch (error) {
                ErrorHandler.handleError('AutoCommentMonitor.review', error, false);
            }
        }
    }

    /**
     * Fügt Kommentar an Position ein
     */
    private async insertComment(
        editor: vscode.TextEditor,
        position: vscode.Position,
        comment: string
    ): Promise<void> {
        const line = editor.document.lineAt(position.line);
        const indentation = line.firstNonWhitespaceCharacterIndex;

        const mockPlacement = {
            comment: comment,
            targetLine: position.line,
            position: 'before' as const,
            indentation: indentation,
            reasoning: 'Auto-Monitor'
        };
        
        const validated = PositionValidator.validateAndCorrect(
            editor.document,
            mockPlacement
        );

        await editor.edit(editBuilder => {
            editBuilder.insert(
                new vscode.Position(validated.targetLine, 0),
                ' '.repeat(validated.indentation) + validated.comment + '\n'
            );
        });
    }

    /**
     * Hash-Funktion für Content
     */
    private hashCode(str: string): string {
        // Entferne Kommentare und Whitespace für Hash
        const normalized = str
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    private timeout(ms: number): Promise<never> {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), ms)
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getStatistics(): AutoCommentStatistics {
        return {
            isActive: !!this.documentSaveListener,
            monitoredDocuments: this.documentedElements.size,
            pendingAnalyses: this.pendingChanges.size
        };
    }

    public dispose(): void {
        this.stop();
        this.documentedElements.clear();
        this.lastProcessedHash.clear();
        this.runningAnalyses.clear();
    }
}

export interface AutoCommentStatistics {
    isActive: boolean;
    monitoredDocuments: number;
    pendingAnalyses: number;
}
