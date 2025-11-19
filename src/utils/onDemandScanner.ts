import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandler';
import { PositionValidator } from '../intelligent-placement/positionValidator';

/**
 * Einmaliger Code-Scanner - KEIN kontinuierliches Monitoring!
 * 
 * Scannt auf Anfrage und zeigt EINE konsolidierte Benachrichtigung
 */
export class OnDemandCodeScanner {
    
    /**
     * Scannt aktuelles Dokument nach undokumentierten Funktionen/Klassen
     */
    static async scanCurrentDocument(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showWarningMessage('❌ Kein aktiver Editor');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🔍 Scanne Code nach undokumentierten Elementen...',
            cancellable: false
        }, async () => {
            const document = editor.document;
            const elements = this.findUndocumentedElements(document);
            
            if (elements.length === 0) {
                vscode.window.showInformationMessage('✅ Alle Funktionen/Klassen sind dokumentiert!');
                return;
            }

            // EINE Benachrichtigung für alle gefundenen Elemente
            this.showConsolidatedResults(elements, editor);
        });
    }

    /**
     * Findet undokumentierte Funktionen/Klassen
     */
    private static findUndocumentedElements(document: vscode.TextDocument): UndocumentedElement[] {
        const elements: UndocumentedElement[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        const languageId = document.languageId;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip Kommentare
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || 
                trimmed.startsWith('*') || trimmed.startsWith('#')) {
                continue;
            }

            // Prüfe ob es eine Funktion/Klasse ist
            const elementType = this.detectElementType(trimmed, languageId);
            
            if (elementType) {
                // Prüfe ob bereits dokumentiert
                const hasComment = this.hasCommentBefore(document, i);
                
                if (!hasComment) {
                    const name = this.extractName(trimmed, elementType, languageId);
                    elements.push({
                        type: elementType,
                        name: name || 'anonymous',
                        line: i,
                        text: trimmed
                    });
                }
            }
        }

        return elements;
    }

    /**
     * Erkennt Element-Typ (function, class, method)
     */
    private static detectElementType(line: string, languageId: string): ElementType | null {
        if (languageId === 'javascript' || languageId === 'typescript' || 
            languageId === 'javascriptreact' || languageId === 'typescriptreact') {
            
            if (/^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/.test(line)) {
                return 'class';
            }
            if (/^\s*(?:export\s+)?(?:async\s+)?function\s+\w+/.test(line)) {
                return 'function';
            }
            if (/^\s*(?:export\s+)?interface\s+\w+/.test(line)) {
                return 'interface';
            }
            if (/^\s*\w+\s*\([^)]*\)(?:\s*:\s*\w+)?\s*\{/.test(line)) {
                return 'method';
            }
            if (/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/.test(line)) {
                return 'function';
            }
        }

        if (languageId === 'python') {
            if (/^\s*class\s+\w+/.test(line)) {
                return 'class';
            }
            if (/^\s*(?:async\s+)?def\s+\w+\s*\(/.test(line)) {
                return 'function';
            }
        }

        return null;
    }

    /**
     * Extrahiert Namen aus Code-Zeile
     */
    private static extractName(line: string, type: ElementType, languageId: string): string | null {
        let match: RegExpMatchArray | null = null;

        switch (type) {
            case 'class':
                match = line.match(/class\s+(\w+)/);
                break;
            case 'function':
                match = line.match(/function\s+(\w+)/) || 
                       line.match(/(?:const|let|var)\s+(\w+)\s*=/) ||
                       line.match(/def\s+(\w+)/);
                break;
            case 'method':
                match = line.match(/(\w+)\s*\(/);
                break;
            case 'interface':
                match = line.match(/interface\s+(\w+)/);
                break;
        }

        return match ? match[1] : null;
    }

    /**
     * Prüft ob Kommentar vor Zeile existiert
     */
    private static hasCommentBefore(document: vscode.TextDocument, line: number): boolean {
        if (line === 0) return false;

        const previousLine = document.lineAt(line - 1).text.trim();
        
        // Prüfe auch 2 Zeilen davor (für mehrzeilige Kommentare)
        let twoLinesBefore = '';
        if (line >= 2) {
            twoLinesBefore = document.lineAt(line - 2).text.trim();
        }

        return (
            previousLine.startsWith('//') ||
            previousLine.startsWith('/*') ||
            previousLine.startsWith('*') ||
            previousLine.startsWith('#') ||
            previousLine.startsWith('"""') ||
            previousLine.includes('*/') ||
            twoLinesBefore.startsWith('/*') ||
            twoLinesBefore.startsWith('"""')
        );
    }

    /**
     * Zeigt konsolidierte Ergebnisse in EINER Benachrichtigung
     */
    private static async showConsolidatedResults(
        elements: UndocumentedElement[],
        editor: vscode.TextEditor
    ): Promise<void> {
        // Gruppiere nach Typ
        const byType: { [key: string]: number } = {};
        elements.forEach(el => {
            byType[el.type] = (byType[el.type] || 0) + 1;
        });

        const summary = Object.entries(byType)
            .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
            .join(', ');

        const action = await vscode.window.showInformationMessage(
            `📊 ${elements.length} undokumentierte Elemente gefunden:\n${summary}`,
            'Liste anzeigen',
            'Alle dokumentieren',
            'Ignorieren'
        );

        if (action === 'Liste anzeigen') {
            await this.showDetailedList(elements, editor);
        } else if (action === 'Alle dokumentieren') {
            await this.documentAllElements(elements, editor);
        }
    }

    /**
     * Zeigt detaillierte Liste im QuickPick
     */
    private static async showDetailedList(
        elements: UndocumentedElement[],
        editor: vscode.TextEditor
    ): Promise<void> {
        const items = elements.map(el => ({
            label: `$(symbol-${el.type}) ${el.name}`,
            description: `Zeile ${el.line + 1}`,
            detail: el.text,
            element: el
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Wähle ein Element zum Dokumentieren',
            canPickMany: false
        });

        if (selected) {
            // Spring zur Zeile
            const position = new vscode.Position(selected.element.line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            // Frage ob dokumentieren
            const action = await vscode.window.showInformationMessage(
                `Dokumentiere ${selected.element.type} "${selected.element.name}"?`,
                'Ja',
                'Mit Spracheingabe',
                'Abbrechen'
            );

            if (action === 'Ja') {
                await this.documentElement(selected.element, editor);
            } else if (action === 'Mit Spracheingabe') {
                // Trigger Voice Recording
                vscode.commands.executeCommand('voiceDocPlugin.toggleRecording');
            }
        }
    }

    /**
     * Dokumentiert alle Elemente nacheinander
     */
    private static async documentAllElements(
        elements: UndocumentedElement[],
        editor: vscode.TextEditor
    ): Promise<void> {
        let documented = 0;

        for (const element of elements) {
            const position = new vscode.Position(element.line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            const action = await vscode.window.showInformationMessage(
                `[${documented + 1}/${elements.length}] ${element.type} "${element.name}"`,
                'Dokumentieren',
                'Überspringen',
                'Abbrechen'
            );

            if (action === 'Dokumentieren') {
                await this.documentElement(element, editor);
                documented++;
            } else if (action === 'Abbrechen') {
                break;
            }
        }

        vscode.window.showInformationMessage(
            `✅ ${documented}/${elements.length} Elemente dokumentiert`
        );
    }

    /**
     * Dokumentiert einzelnes Element
     */
    private static async documentElement(
        element: UndocumentedElement,
        editor: vscode.TextEditor
    ): Promise<void> {
        const text = await vscode.window.showInputBox({
            prompt: `Dokumentation für ${element.type} "${element.name}"`,
            placeHolder: 'Was macht diese Funktion/Klasse?',
            value: this.generateDefaultDescription(element)
        });

        if (!text) return;

        // Formatiere als Kommentar
        const comment = this.formatComment(text, editor.document.languageId);
        
        // Füge an der richtigen Position ein
        await editor.edit(editBuilder => {
            const insertPosition = new vscode.Position(element.line, 0);
            const indentation = editor.document.lineAt(element.line).firstNonWhitespaceCharacterIndex;
            const indent = ' '.repeat(indentation);
            
            editBuilder.insert(insertPosition, indent + comment + '\n');
        });

        ErrorHandler.log('OnDemandScanner', `Dokumentiert: ${element.name}`, 'success');
    }

    /**
     * Generiert Standard-Beschreibung
     */
    private static generateDefaultDescription(element: UndocumentedElement): string {
        switch (element.type) {
            case 'class':
                return `Klasse ${element.name}`;
            case 'function':
                return `Funktion ${element.name}`;
            case 'method':
                return `Methode ${element.name}`;
            case 'interface':
                return `Interface ${element.name}`;
            default:
                return '';
        }
    }

    /**
     * Formatiert Kommentar nach Sprache
     */
    private static formatComment(text: string, languageId: string): string {
        if (languageId === 'python') {
            return `"""\n${text}\n"""`;
        }
        
        if (text.includes('\n')) {
            const lines = text.split('\n');
            return `/**\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;
        }
        
        return `/** ${text} */`;
    }

    /**
     * Scannt ALLE Dateien im Workspace (vorsichtig!)
     */
    static async scanEntireWorkspace(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            '⚠️ Workspace-Scan kann bei großen Projekten lange dauern. Fortfahren?',
            'Ja',
            'Nein'
        );

        if (confirm !== 'Ja') return;

        const files = await vscode.workspace.findFiles(
            '**/*.{ts,js,tsx,jsx,py}',
            '**/node_modules/**',
            100 // Max 100 Dateien
        );

        let totalUndocumented = 0;
        const undocumentedFiles: { file: string; count: number }[] = [];

        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const elements = this.findUndocumentedElements(document);
            
            if (elements.length > 0) {
                totalUndocumented += elements.length;
                undocumentedFiles.push({
                    file: vscode.workspace.asRelativePath(file),
                    count: elements.length
                });
            }
        }

        if (totalUndocumented === 0) {
            vscode.window.showInformationMessage('✅ Alle Dateien sind vollständig dokumentiert!');
            return;
        }

        // Zeige Ergebnisse
        const message = undocumentedFiles
            .slice(0, 5)
            .map(f => `${f.file}: ${f.count}`)
            .join('\n');

        vscode.window.showInformationMessage(
            `📊 Workspace-Scan:\n${totalUndocumented} undokumentierte Elemente in ${undocumentedFiles.length} Dateien\n\n${message}`,
            { modal: true }
        );
    }
}

type ElementType = 'function' | 'class' | 'method' | 'interface';

interface UndocumentedElement {
    type: ElementType;
    name: string;
    line: number;
    text: string;
}
