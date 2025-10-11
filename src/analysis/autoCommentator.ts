import * as vscode from 'vscode';
import { CodeElement } from '../types/codeAnalysis';
import { CommentGenerator } from '../generator';
import { ErrorHandler } from '../utils/errorHandler';
import { ConfigManager } from '../utils/configManager';

/**
 * Automatischer Code-Kommentator
 * Überwacht Dateien und generiert automatisch Kommentare für neuen Code
 */
export class AutoCommentator {
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private generator: CommentGenerator;
    private isEnabled: boolean = false;
    private processedElements: Set<string> = new Set();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(generator: CommentGenerator) {
        this.generator = generator;
    }

    /**
     * Aktiviert die automatische Kommentierung
     */
    async enable(): Promise<void> {
        if (this.isEnabled) {
            return;
        }

        const autoCommentEnabled = ConfigManager.get<boolean>('autoComment.enabled', false);
        if (!autoCommentEnabled) {
            vscode.window.showInformationMessage(
                'Auto-Kommentierung ist deaktiviert. Aktivieren Sie sie in den Einstellungen.',
                'Einstellungen öffnen'
            ).then(action => {
                if (action === 'Einstellungen öffnen') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'voiceDocPlugin.autoComment');
                }
            });
            return;
        }

        this.isEnabled = true;
        this.setupFileWatcher();
        this.setupDocumentListener();
        
        ErrorHandler.log('AutoCommentator', 'Automatische Kommentierung aktiviert', 'success');
        
        vscode.window.showInformationMessage(
            '🤖 Auto-Kommentierung aktiviert! Code wird automatisch analysiert.'
        );
    }

    /**
     * Deaktiviert die automatische Kommentierung
     */
    disable(): void {
        if (!this.isEnabled) {
            return;
        }

        this.isEnabled = false;
        
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }

        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        ErrorHandler.log('AutoCommentator', 'Automatische Kommentierung deaktiviert');
        
        vscode.window.showInformationMessage(
            'Auto-Kommentierung deaktiviert'
        );
    }

    /**
     * Richtet File-Watcher ein
     */
    private setupFileWatcher(): void {
        const patterns = ConfigManager.get<string[]>('autoComment.filePatterns', [
            '**/*.ts',
            '**/*.js',
            '**/*.tsx',
            '**/*.jsx',
            '**/*.py'
        ]);

        // Sicherstellen, dass patterns nicht undefined ist
        if (!patterns || patterns.length === 0) {
            ErrorHandler.handleWarning('AutoCommentator', 'Keine File-Patterns konfiguriert', false);
            return;
        }

        const pattern = `{${patterns.join(',')}}`;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(uri => {
            this.scheduleAnalysis(uri);
        });

        this.fileWatcher.onDidChange(uri => {
            this.scheduleAnalysis(uri);
        });
    }

    /**
     * Richtet Document-Change-Listener ein
     */
    private setupDocumentListener(): void {
        vscode.workspace.onDidChangeTextDocument(event => {
            if (!this.isEnabled) return;

            const delay = ConfigManager.get<number>('autoComment.debounceDelay', 2000);
            const uri = event.document.uri;

            if (this.debounceTimers.has(uri.toString())) {
                clearTimeout(this.debounceTimers.get(uri.toString())!);
            }

            const timer = setTimeout(() => {
                this.analyzeDocument(event.document);
                this.debounceTimers.delete(uri.toString());
            }, delay);

            this.debounceTimers.set(uri.toString(), timer);
        });
    }

    /**
     * Plant Analyse mit Debouncing ein
     */
    private scheduleAnalysis(uri: vscode.Uri): void {
        const delay = ConfigManager.get<number>('autoComment.debounceDelay', 2000);

        if (this.debounceTimers.has(uri.toString())) {
            clearTimeout(this.debounceTimers.get(uri.toString())!);
        }

        const timer = setTimeout(async () => {
            const document = await vscode.workspace.openTextDocument(uri);
            await this.analyzeDocument(document);
            this.debounceTimers.delete(uri.toString());
        }, delay);

        this.debounceTimers.set(uri.toString(), timer);
    }

    /**
     * Analysiert ein Dokument
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        if (!this.isEnabled) return;

        try {
            const content = document.getText();
            const fileName = document.fileName;
            const languageId = document.languageId;

            ErrorHandler.log('AutoCommentator', `Analysiere ${fileName}`);

            // Einfache Syntax-Analyse statt CodeAnalyzer
            const elements = this.simpleCodeAnalysis(content, languageId);

            // Mindest-Komplexität berücksichtigen
            const minComplexity = ConfigManager.get<number>('autoComment.minComplexity', 0) || 0;
            const uncommentedElements = elements.filter((e: CodeElement) => 
                (e.complexity || 0) >= minComplexity
            );

            if (uncommentedElements.length === 0) {
                ErrorHandler.log('AutoCommentator', 'Keine unkommentierten Elemente gefunden');
                return;
            }

            ErrorHandler.log('AutoCommentator', `${uncommentedElements.length} unkommentierte Elemente gefunden`);

            await this.suggestComments(document, uncommentedElements);

        } catch (error) {
            ErrorHandler.handleError('AutoCommentator', error, false);
        }
    }

    /**
     * Einfache Code-Analyse (ohne KI)
     */
    private simpleCodeAnalysis(content: string, languageId: string): CodeElement[] {
        const elements: CodeElement[] = [];
        const lines = content.split('\n');

        // Einfache Regex-basierte Analyse für Funktionen und Klassen
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // TypeScript/JavaScript Funktionen
            const funcMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+(\w+)/);
            if (funcMatch) {
                elements.push({
                    type: 'function',
                    name: funcMatch[3],
                    startLine: i,
                    endLine: i,
                    complexity: 5,
                    isAsync: !!funcMatch[2],
                    isExported: !!funcMatch[1]
                });
            }

            // Klassen
            const classMatch = line.match(/^\s*(export\s+)?(abstract\s+)?class\s+(\w+)/);
            if (classMatch) {
                elements.push({
                    type: 'class',
                    name: classMatch[3],
                    startLine: i,
                    endLine: i,
                    complexity: 10,
                    isAbstract: !!classMatch[2],
                    isExported: !!classMatch[1]
                });
            }

            // Methoden
            const methodMatch = line.match(/^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\(/);
            if (methodMatch && !funcMatch) {
                elements.push({
                    type: 'method',
                    name: methodMatch[4],
                    startLine: i,
                    endLine: i,
                    complexity: 5,
                    isAsync: !!methodMatch[3],
                    isStatic: !!methodMatch[2],
                    isPrivate: methodMatch[1] === 'private'
                });
            }
        }

        return elements;
    }

    /**
     * Schlägt Kommentare für Elemente vor
     */
    private async suggestComments(
        document: vscode.TextDocument,
        elements: CodeElement[]
    ): Promise<void> {
        const mode = ConfigManager.get<string>('autoComment.mode', 'suggest');

        if (mode === 'suggest') {
            await this.showSuggestions(document, elements);
        } else if (mode === 'auto') {
            await this.autoInsertComments(document, elements);
        }
    }

    /**
     * Zeigt Vorschläge für Kommentare
     */
    private async showSuggestions(
        document: vscode.TextDocument,
        elements: CodeElement[]
    ): Promise<void> {
        const items = elements.map(el => ({
            label: `$(symbol-${el.type}) ${el.name}`,
            description: `Zeile ${el.startLine + 1}`,
            detail: this.generateDetailText(el),
            element: el
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Wähle Elemente zum Kommentieren',
            canPickMany: true
        });

        if (!selected || selected.length === 0) {
            return;
        }

        for (const item of selected) {
            await this.insertCommentForElement(document, item.element);
        }
    }

    /**
     * Fügt automatisch Kommentare ein
     */
    private async autoInsertComments(
        document: vscode.TextDocument,
        elements: CodeElement[]
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }

        const maxAuto = ConfigManager.get<number>('autoComment.maxAutoInserts', 5);
        const toProcess = elements.slice(0, maxAuto);

        let insertedCount = 0;

        for (const element of toProcess) {
            const success = await this.insertCommentForElement(document, element);
            if (success) {
                insertedCount++;
            }
        }

        if (insertedCount > 0) {
            vscode.window.showInformationMessage(
                `🤖 ${insertedCount} Kommentare automatisch eingefügt`
            );
        }
    }

    /**
     * Fügt Kommentar für ein Element ein
     */
    private async insertCommentForElement(
        document: vscode.TextDocument,
        element: CodeElement
    ): Promise<boolean> {
        try {
            const elementKey = `${document.uri.toString()}-${element.startLine}-${element.name}`;
            
            if (this.processedElements.has(elementKey)) {
                return false;
            }

            const comment = await this.generateCommentForElement(element, document.languageId);
            
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document !== document) {
                return false;
            }

            const line = document.lineAt(element.startLine);
            const indentation = ' '.repeat(line.firstNonWhitespaceCharacterIndex);
            
            await editor.edit(editBuilder => {
                editBuilder.insert(
                    new vscode.Position(element.startLine, 0),
                    indentation + comment + '\n'
                );
            });

            this.processedElements.add(elementKey);
            
            ErrorHandler.log('AutoCommentator', `Kommentar eingefügt für ${element.name}`, 'success');
            
            return true;

        } catch (error) {
            ErrorHandler.handleError('AutoCommentator', error, false);
            return false;
        }
    }

    /**
     * Generiert Kommentar für ein Element
     */
    private async generateCommentForElement(
        element: CodeElement,
        languageId: string
    ): Promise<string> {
        const description = this.createDescription(element);
        
        const useAI = ConfigManager.get<boolean>('autoComment.useAI', false);
        
        if (useAI && this.generator.isOpenAIAvailable()) {
            try {
                // Nur wenn body existiert
                const codeBody = element.body || '';
                const enhanced = await this.generator.enhanceWithOpenAI(description, codeBody);
                return this.generator.formatComment(enhanced, languageId);
            } catch (error) {
                ErrorHandler.log('AutoCommentator', 'KI-Verbesserung fehlgeschlagen, verwende Standard');
            }
        }

        return this.generator.formatComment(description, languageId);
    }

    /**
     * Erstellt Beschreibung für ein Element
     */
    private createDescription(element: CodeElement): string {
        const parts: string[] = [];

        // Type guard für Funktionen und Methoden
        const isFunctionLike = element.type === 'function' || 
                              element.type === 'method' || 
                              element.type === 'arrow-function';

        if (isFunctionLike) {
            if (element.isAsync) {
                parts.push('Asynchrone');
            }
            if (element.isStatic) {
                parts.push('Statische');
            }
            if (element.isPrivate) {
                parts.push('Private');
            }

            parts.push(element.type === 'method' ? 'Methode' : 'Funktion');
            parts.push(`${element.name}`);

            if (element.parameters && element.parameters.length > 0) {
                const params = element.parameters.map((p: { name: string; type: string }) => 
                    `${p.name}: ${p.type}`
                ).join(', ');
                parts.push(`mit Parametern (${params})`);
            }

            if (element.returnType && element.returnType !== 'void') {
                parts.push(`Gibt ${element.returnType} zurück`);
            }

            if (element.complexity && element.complexity > 10) {
                parts.push(`(Komplexität: ${element.complexity})`);
            }
        } else if (element.type === 'class') {
            if (element.isAbstract) {
                parts.push('Abstrakte');
            }
            if (element.isExported) {
                parts.push('Exportierte');
            }

            parts.push(`Klasse ${element.name}`);

            if (element.methods && element.methods.length > 0) {
                parts.push(`mit ${element.methods.length} Methoden`);
            }
        }

        return parts.join(' ');
    }

    /**
     * Generiert Detail-Text für QuickPick
     */
    private generateDetailText(element: CodeElement): string {
        const details: string[] = [];

        if (element.isExported) details.push('exported');
        if (element.isAsync) details.push('async');
        if (element.isStatic) details.push('static');
        if (element.isPrivate) details.push('private');

        if (element.parameters && element.parameters.length > 0) {
            details.push(`${element.parameters.length} Parameter`);
        }

        if (element.complexity) {
            details.push(`Komplexität: ${element.complexity}`);
        }

        return details.join(' • ');
    }

    /**
     * Löscht Cache der verarbeiteten Elemente
     */
    clearCache(): void {
        this.processedElements.clear();
        ErrorHandler.log('AutoCommentator', 'Cache geleert');
    }

    /**
     * Gibt Status zurück
     */
    getStatus(): {
        isEnabled: boolean;
        processedCount: number;
        watchedFiles: number;
    } {
        return {
            isEnabled: this.isEnabled,
            processedCount: this.processedElements.size,
            watchedFiles: this.debounceTimers.size
        };
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.disable();
        this.processedElements.clear();
    }
}
