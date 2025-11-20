// src/placement/intelligentPlacer.ts
// Intelligente Kommentar-Platzierung basierend auf AST-Analyse
// ✨ Neu hinzugefügt für Diplomarbeit - Multi-Kriterien-Scoring-System

import { ASTAnalyzer, CodeElement } from '../offline-intelligence/astAnalyzerAdapter';
import * as vscode from 'vscode';

export interface PlacementSuggestion {
    line: number;
    reason: string;
    confidence: number;
    element: CodeElement;
}

/**
 * Findet die beste Position für Code-Kommentare
 * Nutzt AST-Analyse und Heuristiken für intelligente Platzierung
 * Berechnet Konfidenz-Score basierend auf 5 Kriterien
 */
export class IntelligentCommentPlacer {
    private astAnalyzer: ASTAnalyzer;

    constructor() {
        this.astAnalyzer = new ASTAnalyzer();
    }

    /**
     * Findet beste Position für Kommentar
     */
    public async findBestPlacement(
        editor: vscode.TextEditor,
        commentText: string,
        cursorPosition: vscode.Position
    ): Promise<PlacementSuggestion[]> {
        const document = editor.document;
        const code = document.getText();
        
        // 1. Analysiere Code mit AST
        const elements = this.astAnalyzer.analyzeCode(code, document.fileName);

        // 2. Finde relevante Elemente
        const relevantElements = this.findRelevantElements(
            elements,
            cursorPosition,
            commentText
        );

        // 3. Bewerte jedes Element
        const suggestions = relevantElements
            .map(element => this.scorePlacement(element, commentText, cursorPosition))
            .sort((a, b) => b.confidence - a.confidence);

        return suggestions;
    }

    /**
     * Platziert Kommentar intelligent mit User-Feedback
     */
    public async placeCommentIntelligently(
        editor: vscode.TextEditor,
        commentText: string,
        cursorPosition: vscode.Position
    ): Promise<boolean> {
        const suggestions = await this.findBestPlacement(
            editor,
            commentText,
            cursorPosition
        );

        if (suggestions.length === 0) {
            const fallback = await vscode.window.showWarningMessage(
                '⚠️ Keine passende Position gefunden.',
                'An Cursor einfügen',
                'Abbrechen'
            );

            if (fallback === 'An Cursor einfügen') {
                await this.insertAtCursor(editor, commentText, cursorPosition);
                return true;
            }
            return false;
        }

        // Beste Suggestion
        const best = suggestions[0];

        // Zeige Preview mit Konfidenz-Score
        const action = await this.showPlacementPreview(best, suggestions.length);

        if (action === 'Einfügen') {
            await this.insertAtLine(editor, commentText, best.line - 1, best.element);
            return true;
        } else if (action === 'Alternativen') {
            return await this.showAlternatives(editor, commentText, suggestions);
        }

        return false;
    }

    /**
     * Zeigt Platzierungs-Preview mit Konfidenz-Score
     */
    private async showPlacementPreview(
        suggestion: PlacementSuggestion,
        totalSuggestions: number
    ): Promise<string | undefined> {
        const confidence = Math.round(suggestion.confidence * 100);
        const icon = this.getConfidenceIcon(suggestion.confidence);

        const message = [
            `${icon} Beste Position gefunden`,
            ``,
            `📍 ${suggestion.element.type}: "${suggestion.element.name}"`,
            `📊 Konfidenz: ${confidence}%`,
            `💡 ${suggestion.reason}`,
            totalSuggestions > 1 ? `\n(${totalSuggestions - 1} weitere Optionen)` : ''
        ].join('\n');

        const options = ['Einfügen', 'Abbrechen'];
        if (totalSuggestions > 1) {
            options.splice(1, 0, 'Alternativen');
        }

        return await vscode.window.showInformationMessage(message, ...options);
    }

    /**
     * Zeigt alternative Platzierungen
     */
    private async showAlternatives(
        editor: vscode.TextEditor,
        commentText: string,
        suggestions: PlacementSuggestion[]
    ): Promise<boolean> {
        const items = suggestions.map(s => ({
            label: `$(symbol-${s.element.type}) ${s.element.name}`,
            description: `Zeile ${s.line} • ${Math.round(s.confidence * 100)}%`,
            detail: s.reason,
            suggestion: s
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Wähle Position für Kommentar',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await this.insertAtLine(
                editor,
                commentText,
                selected.suggestion.line - 1,
                selected.suggestion.element
            );
            return true;
        }

        return false;
    }

    /**
     * Findet relevante Code-Elemente basierend auf Cursor und Text
     */
    private findRelevantElements(
        elements: CodeElement[],
        cursorPosition: vscode.Position,
        commentText: string
    ): CodeElement[] {
        const cursorLine = cursorPosition.line + 1; // AST ist 1-basiert
        
        return elements.filter(element => {
            // 1. In der Nähe (±10 Zeilen)
            const distance = Math.abs(element.line - cursorLine);
            if (distance > 10) return false;

            // 2. Noch kein Kommentar
            if (element.hasComment) return false;

            // 3. Relevant für Text
            if (!this.isRelevantForComment(element, commentText)) {
                // Aber: Wenn sehr nah am Cursor, trotzdem einbeziehen
                if (distance <= 2) return true;
                return false;
            }

            return true;
        });
    }

    /**
     * Prüft Relevanz des Elements für Kommentar
     */
    private isRelevantForComment(element: CodeElement, commentText: string): boolean {
        const lowerComment = commentText.toLowerCase();
        const lowerName = element.name.toLowerCase();

        // 1. Name erwähnt
        if (lowerComment.includes(lowerName)) {
            return true;
        }

        // 2. Type-Keywords
        const keywords = this.getTypeKeywords(element.type);
        return keywords.some(kw => lowerComment.includes(kw));
    }

    /**
     * Keywords für Element-Typen
     */
    private getTypeKeywords(type: string): string[] {
        const keywords: { [key: string]: string[] } = {
            function: ['funktion', 'function', 'methode', 'berechnet', 'gibt zurück', 'return'],
            class: ['klasse', 'class', 'objekt', 'struktur', 'enthält'],
            method: ['methode', 'method', 'funktion', 'macht', 'führt aus'],
            variable: ['variable', 'wert', 'speichert', 'enthält', 'ist'],
            interface: ['interface', 'schnittstelle', 'definiert', 'typ']
        };

        return keywords[type] || [];
    }

    /**
     * Bewertet Platzierungs-Option mit Multi-Kriterien-Scoring
     * Kriterien: Distanz (30%), Name-Match (25%), Komplexität (20%), Parameter (15%), Type-Relevanz (10%)
     */
    private scorePlacement(
        element: CodeElement,
        commentText: string,
        cursorPosition: vscode.Position
    ): PlacementSuggestion {
        let confidence = 0.3; // Basis
        const reasons: string[] = [];

        // 1. Distanz zum Cursor (max 0.3)
        const distance = Math.abs(element.line - (cursorPosition.line + 1));
        if (distance === 0) {
            confidence += 0.3;
            reasons.push('Cursor am Element');
        } else if (distance === 1) {
            confidence += 0.25;
            reasons.push('Cursor sehr nah');
        } else if (distance <= 2) {
            confidence += 0.2;
            reasons.push('Cursor nah');
        } else if (distance <= 5) {
            confidence += 0.1;
        }

        // 2. Name-Match (max 0.25)
        const lowerComment = commentText.toLowerCase();
        const lowerName = element.name.toLowerCase();
        
        if (lowerComment.includes(lowerName)) {
            const exactMatch = lowerComment.split(' ').includes(lowerName);
            if (exactMatch) {
                confidence += 0.25;
                reasons.push(`Name "${element.name}" erwähnt`);
            } else {
                confidence += 0.15;
                reasons.push(`Name-Teil erwähnt`);
            }
        }

        // 3. Komplexität (max 0.2)
        if (element.complexity > 10) {
            confidence += 0.2;
            reasons.push(`Sehr komplex (${element.complexity})`);
        } else if (element.complexity > 5) {
            confidence += 0.15;
            reasons.push(`Komplex (${element.complexity})`);
        } else if (element.complexity > 3) {
            confidence += 0.1;
        }

        // 4. Parameter (max 0.15)
        if (element.parameters && element.parameters.length > 0) {
            if (element.parameters.length > 3) {
                confidence += 0.15;
                reasons.push(`${element.parameters.length} Parameter`);
            } else {
                confidence += 0.1;
                reasons.push(`${element.parameters.length} Parameter`);
            }
        }

        // 5. Type-Relevanz (max 0.1)
        const keywords = this.getTypeKeywords(element.type);
        const hasKeyword = keywords.some(kw => lowerComment.includes(kw));
        if (hasKeyword) {
            confidence += 0.1;
            reasons.push('Typ-relevant');
        }

        // Normalisiere auf 0-1
        confidence = Math.min(confidence, 1.0);

        return {
            line: element.line,
            reason: reasons.join(', '),
            confidence,
            element
        };
    }

    /**
     * Fügt Kommentar an Zeile ein
     */
    private async insertAtLine(
        editor: vscode.TextEditor,
        commentText: string,
        line: number,
        element: CodeElement
    ): Promise<void> {
        const document = editor.document;
        const lineText = document.lineAt(line).text;
        const indentation = lineText.match(/^\s*/)?.[0] || '';

        const formatted = this.formatForElement(
            commentText,
            element,
            document.languageId
        );

        await editor.edit(editBuilder => {
            editBuilder.insert(
                new vscode.Position(line, 0),
                indentation + formatted + '\n'
            );
        });

        // Highlight neue Zeile
        const newPosition = new vscode.Position(line, indentation.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(new vscode.Range(line, 0, line + 3, 0));
    }

    /**
     * Formatiert Kommentar für Element-Typ
     */
    private formatForElement(
        text: string,
        element: CodeElement,
        languageId: string
    ): string {
        // Funktionen/Methoden: JSDoc mit Parametern
        if (element.type === 'function' || element.type === 'method') {
            const lines = ['/**', ` * ${text}`];

            if (element.parameters && element.parameters.length > 0) {
                lines.push(' *');
                element.parameters.forEach((param: { name: string; type?: string }) => {
                    const typeAnnot = param.type ? ` {${param.type}}` : '';
                    lines.push(` * @param${typeAnnot} ${param.name}`);
                });
            }

            if (element.returnType) {
                lines.push(` * @returns {${element.returnType}}`);
            }

            lines.push(' */');
            return lines.join('\n');
        }

        // Klassen/Interfaces: JSDoc
        if (element.type === 'class' || element.type === 'interface') {
            return `/**\n * ${text}\n */`;
        }

        // Variablen: Single-line
        return `// ${text}`;
    }

    /**
     * Fallback: Cursor-Position
     */
    private async insertAtCursor(
        editor: vscode.TextEditor,
        commentText: string,
        position: vscode.Position
    ): Promise<void> {
        const lineText = editor.document.lineAt(position.line).text;
        const indentation = lineText.match(/^\s*/)?.[0] || '';

        await editor.edit(editBuilder => {
            editBuilder.insert(
                new vscode.Position(position.line, 0),
                indentation + `// ${commentText}\n`
            );
        });
    }

    /**
     * Confidence-Icon basierend auf Score
     */
    private getConfidenceIcon(confidence: number): string {
        if (confidence >= 0.8) return '🎯';
        if (confidence >= 0.6) return '✅';
        if (confidence >= 0.4) return '👍';
        return '💡';
    }

    /**
     * Zeigt Code-Analyse für aktuelle Datei
     */
    public async showCodeAnalysis(editor: vscode.TextEditor): Promise<void> {
        const code = editor.document.getText();
        const elements = this.astAnalyzer.analyzeCode(
            code,
            editor.document.fileName
        );

        const stats = this.astAnalyzer.getStatistics(elements);
        const undocumented = this.astAnalyzer.findUndocumented(elements);
        const complex = this.astAnalyzer.findComplexFunctions(elements, 5);

        const message = [
            '📊 Code-Analyse (AST)',
            '',
            `📝 Gesamt: ${stats.total} Elemente`,
            `✅ Dokumentiert: ${stats.documented}`,
            `⚠️ Undokumentiert: ${stats.undocumented}`,
            '',
            `📈 Ø Komplexität: ${stats.avgComplexity.toFixed(1)}`,
            `🔴 Komplexe Funktionen: ${complex.length}`,
            '',
            'Nach Typ:',
            ...Object.entries(stats.byType).map(([type, count]) => 
                `  • ${type}: ${count}`
            )
        ].join('\n');

        const action = await vscode.window.showInformationMessage(
            message,
            'Undokumentierte zeigen',
            'Komplexe zeigen',
            'OK'
        );

        if (action === 'Undokumentierte zeigen') {
            await this.showElementList(editor, undocumented, 'Undokumentierte Elemente');
        } else if (action === 'Komplexe zeigen') {
            await this.showElementList(editor, complex, 'Komplexe Funktionen');
        }
    }

    /**
     * Zeigt Liste von Code-Elementen
     */
    private async showElementList(
        editor: vscode.TextEditor,
        elements: CodeElement[],
        title: string
    ): Promise<void> {
        const items = elements.map(el => ({
            label: `$(symbol-${el.type}) ${el.name}`,
            description: `Zeile ${el.line}`,
            detail: el.complexity > 1 ? `Komplexität: ${el.complexity}` : undefined,
            element: el
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: title,
            matchOnDescription: true
        });

        if (selected) {
            const position = new vscode.Position(selected.element.line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        }
    }
}
