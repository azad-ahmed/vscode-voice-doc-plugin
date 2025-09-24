import * as vscode from 'vscode';
import { AIService } from './services/aiService';

export class CommentGenerator {
    private language: string;
    private aiService: AIService;

    constructor(language: string = 'auto') {
        this.language = language;
        this.aiService = new AIService();
    }

    /**
     * Formatiert einen transkribierten Text zu einem Code-Kommentar
     */
    async formatComment(transcript: string, languageId: string, codeContext?: string): Promise<string> {
        if (!transcript || transcript.trim().length === 0) {
            return '// Keine Spracheingabe erkannt';
        }

        try {
            // AI-Enhancement verwenden mit Progress-Anzeige
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Voice Doc",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Verarbeite Spracheingabe mit AI..." });
                
                const aiResponse = await this.aiService.enhanceComment(transcript, codeContext, languageId);
                
                if (!aiResponse.success && aiResponse.error) {
                    vscode.window.showWarningMessage(`AI Enhancement: ${aiResponse.error}`);
                    progress.report({ message: "Verwende lokale Verarbeitung..." });
                }

                const processedText = aiResponse.success ? aiResponse.text : this.processTextLocally(transcript);
                return this.generateCommentForLanguage(processedText, languageId);
            });

            return result;
            
        } catch (error) {
            console.error('Error in formatComment:', error);
            // Fallback zu lokaler Verarbeitung
            const processedText = this.processTextLocally(transcript);
            return this.generateCommentForLanguage(processedText, languageId);
        }
    }

    /**
     * Verarbeitet Text nur lokal ohne AI
     */
    private processTextLocally(text: string): string {
        const cleanedText = this.cleanTranscript(text);
        return this.processText(cleanedText);
    }

    /**
     * Bereinigt Transcript von Füllwörtern und Störungen
     */
    private cleanTranscript(transcript: string): string {
        return transcript
            .trim()
            .replace(/\s+/g, ' ') // Mehrfache Leerzeichen entfernen
            .replace(/^(äh|ähm|also|ja|okay)\s*/gi, '') // Füllwörter am Anfang
            .replace(/\s+(äh|ähm|also)\s+/gi, ' ') // Füllwörter in der Mitte
            .replace(/\.$/, '') // Punkt am Ende entfernen
            .trim();
    }

    /**
     * Verarbeitet und verbessert den bereinigten Text
     */
    private processText(text: string): string {
        if (text.length === 0) {
            return text;
        }
        
        // Fachbegriffe erkennen und korrigieren
        text = this.replaceTechnicalTerms(text);
        
        // Satzstruktur verbessern
        text = this.improveSentenceStructure(text);
        
        // Ersten Buchstaben großschreiben
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    /**
     * Ersetzt und korrigiert technische Begriffe
     */
    private replaceTechnicalTerms(text: string): string {
        const replacements: { [key: string]: string } = {
            'funktion': 'Funktion',
            'methode': 'Methode',
            'klasse': 'Klasse',
            'variable': 'Variable',
            'parameter': 'Parameter',
            'return': 'Return',
            'array': 'Array',
            'objekt': 'Objekt',
            'string': 'String',
            'integer': 'Integer',
            'boolean': 'Boolean',
            'loop': 'Schleife',
            'schleife': 'Schleife',
            'bedingung': 'Bedingung',
            'condition': 'Bedingung',
            'if': 'If-Bedingung',
            'else': 'Else-Zweig',
            'tryBlock': 'Try-Block',
            'catchBlock': 'Catch-Block',
            'tryCatch': 'Try-Catch-Block',
            'exception': 'Exception',
            'fehlerbehandlung': 'Fehlerbehandlung',
            'errorHandling': 'Fehlerbehandlung',
            'api': 'API',
            'database': 'Datenbank',
            'datenbank': 'Datenbank',
            'sql': 'SQL',
            'query': 'Query',
            'json': 'JSON',
            'xml': 'XML',
            'html': 'HTML',
            'css': 'CSS',
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'java': 'Java',
            'csharp': 'C#',
            'callback': 'Callback',
            'promise': 'Promise',
            'async': 'Async',
            'await': 'Await'
        };

        let result = text;
        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`\\b${key}\\b`, 'gi');
            result = result.replace(regex, replacements[key]);
        });

        return result;
    }

    /**
     * Verbessert die Satzstruktur
     */
    private improveSentenceStructure(text: string): string {
        const improvements = [
            {
                pattern: /^(diese|die|der|das)\s+(.+?)\s+(macht|tut|ist|wird)/i,
                replacement: '$2 $3'
            },
            {
                pattern: /^hier\s+(.+)/i,
                replacement: '$1'
            },
            {
                pattern: /^(berechnet|erstellt|initialisiert|definiert)\s+(.+)/i,
                replacement: '$1 $2'
            },
            {
                pattern: /^(das|die|der)\s+(ist|sind)\s+(.+)/i,
                replacement: '$3'
            }
        ];

        let result = text;
        improvements.forEach(improvement => {
            result = result.replace(improvement.pattern, improvement.replacement);
        });

        return result;
    }

    /**
     * Generiert sprachspezifische Kommentare
     */
    private generateCommentForLanguage(text: string, languageId: string): string {
        const config = vscode.workspace.getConfiguration('voiceDoc');
        const commentStyle = config.get<string>('commentStyle', 'inline');
        const commentStyles = this.getCommentStyle(languageId);
        
        // Prüfe ob Text bereits als Kommentar formatiert ist (von AI)
        if (this.isAlreadyFormatted(text)) {
            return text;
        }
        
        switch (commentStyle) {
            case 'block':
                return this.generateBlockComment(text, commentStyles);
            case 'docstring':
                return this.generateDocstringComment(text, commentStyles);
            default: // inline
                return this.generateInlineComment(text, commentStyles);
        }
    }

    /**
     * Prüft ob Text bereits formatiert ist
     */
    private isAlreadyFormatted(text: string): boolean {
        const commentPrefixes = ['//', '/*', '#', '<!--', '"""', "'''"];
        return commentPrefixes.some(prefix => text.trim().startsWith(prefix));
    }

    /**
     * Generiert Inline-Kommentare
     */
    private generateInlineComment(text: string, commentStyles: CommentStyle): string {
        if (text.length <= 80) {
            return `${commentStyles.single} ${text}`;
        } else {
            const lines = this.wrapText(text, 70);
            return lines.map(line => `${commentStyles.single} ${line}`).join('\n');
        }
    }

    /**
     * Generiert Block-Kommentare
     */
    private generateBlockComment(text: string, commentStyles: CommentStyle): string {
        if (commentStyles.multi) {
            const lines = this.wrapText(text, 70);
            return commentStyles.multi.start + '\n' + 
                   lines.map(line => ` * ${line}`).join('\n') + '\n' + 
                   commentStyles.multi.end;
        }
        // Fallback zu inline
        return this.generateInlineComment(text, commentStyles);
    }

    /**
     * Generiert Documentation-Kommentare
     */
    private generateDocstringComment(text: string, commentStyles: CommentStyle): string {
        const lines = this.wrapText(text, 70);
        
        // JSDoc-Style für JavaScript/TypeScript
        if (['javascript', 'typescript'].includes(commentStyles.languageId || '')) {
            return '/**\n' + 
                   lines.map(line => ` * ${line}`).join('\n') + '\n' + 
                   ' */';
        }
        
        // Python docstring
        if (commentStyles.languageId === 'python') {
            return '"""\n' + 
                   lines.join('\n') + '\n' + 
                   '"""';
        }
        
        // Fallback zu block comment
        return this.generateBlockComment(text, commentStyles);
    }

    /**
     * Ermittelt Kommentar-Stil für Sprache
     */
    private getCommentStyle(languageId: string): CommentStyle {
        const styles: { [key: string]: CommentStyle } = {
            'javascript': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'javascript'
            },
            'typescript': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'typescript'
            },
            'java': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'java'
            },
            'csharp': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'csharp'
            },
            'cpp': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'cpp'
            },
            'c': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'c'
            },
            'python': { 
                single: '#',
                multi: { start: '"""', end: '"""' },
                languageId: 'python'
            },
            'html': { 
                single: '<!--', 
                multi: { start: '<!--', end: '-->' },
                languageId: 'html'
            },
            'css': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'css'
            },
            'scss': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'scss'
            },
            'sql': { 
                single: '--',
                languageId: 'sql'
            },
            'bash': { 
                single: '#',
                languageId: 'bash'
            },
            'powershell': { 
                single: '#',
                languageId: 'powershell'
            },
            'ruby': { 
                single: '#',
                languageId: 'ruby'
            },
            'php': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'php'
            },
            'go': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'go'
            },
            'rust': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'rust'
            },
            'dart': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'dart'
            },
            'kotlin': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'kotlin'
            },
            'swift': { 
                single: '//', 
                multi: { start: '/*', end: ' */' },
                languageId: 'swift'
            }
        };

        return styles[languageId] || { 
            single: '//', 
            multi: { start: '/*', end: ' */' },
            languageId: languageId
        };
    }

    /**
     * Bricht Text in Zeilen um
     */
    private wrapText(text: string, maxLength: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const potentialLine = currentLine ? `${currentLine} ${word}` : word;
            
            if (potentialLine.length <= maxLength) {
                currentLine = potentialLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [text];
    }

    /**
     * Generiert kontextbasierte Kommentare
     */
    async generateContextualComment(transcript: string, codeContext: string): Promise<string> {
        const editor = vscode.window.activeTextEditor;
        const languageId = editor?.document.languageId || 'typescript';
        
        return await this.formatComment(transcript, languageId, codeContext);
    }

    /**
     * Validiert die Qualität eines generierten Kommentars
     */
    validateComment(comment: string): CommentValidation {
        const suggestions: string[] = [];
        let score = 100;

        // Mindestlänge prüfen
        if (comment.length < 10) {
            score -= 30;
            suggestions.push('Kommentar ist zu kurz');
        }

        // Maximallänge prüfen
        if (comment.length > 500) {
            score -= 20;
            suggestions.push('Kommentar ist sehr lang - eventuell aufteilen');
        }

        // Füllwörter prüfen
        const fillerWords = ['äh', 'ähm', 'also', 'ja', 'okay'];
        const hasFillers = fillerWords.some(word => 
            comment.toLowerCase().includes(word)
        );
        if (hasFillers) {
            score -= 15;
            suggestions.push('Füllwörter entdeckt');
        }

        // Leerzeilen prüfen
        const emptyLines = comment.split('\n').filter(line => line.trim().length === 0).length;
        if (emptyLines > 2) {
            score -= 10;
            suggestions.push('Zu viele Leerzeilen');
        }

        // Technische Begriffe prüfen
        const technicalTerms = ['function', 'method', 'variable', 'class', 'api'];
        const hasTechnicalTerms = technicalTerms.some(term => 
            comment.toLowerCase().includes(term)
        );
        if (hasTechnicalTerms) {
            score += 5; // Bonus für technische Präzision
        }

        return {
            isValid: score >= 50,
            score: Math.max(0, Math.min(100, score)),
            suggestions,
            hasFillers,
            wordCount: comment.split(' ').length,
            lineCount: comment.split('\n').length
        };
    }

    /**
     * Erstellt einen Preview des Kommentars
     */
    async previewComment(transcript: string, languageId: string, codeContext?: string): Promise<CommentPreview> {
        const comment = await this.formatComment(transcript, languageId, codeContext);
        const validation = this.validateComment(comment);
        
        return {
            originalTranscript: transcript,
            generatedComment: comment,
            validation,
            languageId,
            timestamp: new Date().toISOString()
        };
    }
}

// Type Definitions
interface CommentStyle {
    single: string;
    multi?: { start: string; end: string };
    languageId?: string;
}

interface CommentValidation {
    isValid: boolean;
    score: number;
    suggestions: string[];
    hasFillers: boolean;
    wordCount: number;
    lineCount: number;
}

interface CommentPreview {
    originalTranscript: string;
    generatedComment: string;
    validation: CommentValidation;
    languageId: string;
    timestamp: string;
}