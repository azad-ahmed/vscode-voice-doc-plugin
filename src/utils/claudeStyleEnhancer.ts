import { ErrorHandler } from './errorHandler';

/**
 * Intelligenter Kommentar-Enhancer mit Claude-ähnlichem Stil
 * Generiert professionelle, strukturierte JSDoc-Kommentare
 */
export class ClaudeStyleEnhancer {
    
    /**
     * Verbessert einen Kommentar im Claude-Stil
     * @param {string} transcript - Ursprüngliche Spracheingabe
     * @param {string} codeContext - Umgebender Code-Kontext
     * @param {string} languageId - Programmiersprache
     * @returns {string} Verbesserter Kommentar im Claude-Stil
     */
    static enhanceComment(transcript: string, codeContext: string, languageId: string): string {
        try {
            // Analysiere Code-Kontext
            const analysis = this.analyzeCodeContext(codeContext);
            
            // Generiere Basis-Beschreibung
            const description = this.generateDescription(transcript, analysis);
            
            // Füge JSDoc-Tags hinzu
            const jsDocTags = this.generateJSDocTags(analysis);
            
            // Kombiniere zu finalem Kommentar
            return this.formatFinalComment(description, jsDocTags, languageId);
            
        } catch (error) {
            ErrorHandler.log('ClaudeStyleEnhancer', 'Fallback zu einfachem Format');
            return transcript;
        }
    }
    
    /**
     * Analysiert Code-Kontext für bessere Kommentare
     * @private
     */
    private static analyzeCodeContext(code: string): {
        type: 'class' | 'function' | 'method' | 'unknown';
        name: string;
        params: Array<{ name: string; type?: string }>;
        isAsync: boolean;
        hasReturn: boolean;
    } {
        const analysis = {
            type: 'unknown' as 'class' | 'function' | 'method' | 'unknown',
            name: 'unknown',
            params: [] as Array<{ name: string; type?: string }>,
            isAsync: false,
            hasReturn: false
        };
        
        // Erkenne Typ
        if (/class\s+(\w+)/.test(code)) {
            analysis.type = 'class';
            const match = code.match(/class\s+(\w+)/);
            if (match) analysis.name = match[1];
        } else if (/function\s+(\w+)/.test(code)) {
            analysis.type = 'function';
            const match = code.match(/function\s+(\w+)/);
            if (match) analysis.name = match[1];
        } else if (/(\w+)\s*\([^)]*\)\s*{/.test(code)) {
            analysis.type = 'method';
            const match = code.match(/(\w+)\s*\([^)]*\)\s*{/);
            if (match) analysis.name = match[1];
        }
        
        // Erkenne async
        analysis.isAsync = code.includes('async');
        
        // Erkenne return
        analysis.hasReturn = code.includes('return');
        
        // Extrahiere Parameter
        const paramMatch = code.match(/\(([^)]*)\)/);
        if (paramMatch && paramMatch[1].trim()) {
            const params = paramMatch[1].split(',').map(p => p.trim());
            analysis.params = params.map(p => {
                const name = p.split('=')[0].trim();
                return { name };
            });
        }
        
        return analysis;
    }
    
    /**
     * Generiert kompakte, präzise Beschreibung
     * @private
     */
    private static generateDescription(transcript: string, analysis: any): string {
        // Bereinige Transkript
        let description = transcript
            .trim()
            .replace(/^(äh|ähm|also|ja|okay)\s*/gi, '')
            .trim();
        
        // Erster Buchstabe groß
        description = description.charAt(0).toUpperCase() + description.slice(1);
        
        // Entferne Punkt am Ende (wird später hinzugefügt)
        description = description.replace(/[.,;:!?]+$/, '');
        
        // Füge Kontext-spezifische Präfixe hinzu
        if (analysis.type === 'class') {
            if (!description.toLowerCase().includes('klasse') && 
                !description.toLowerCase().includes('service') &&
                !description.toLowerCase().includes('manager')) {
                // Wenn nicht bereits "Klasse" oder ähnliches erwähnt
                description = this.addClassPrefix(description);
            }
        }
        
        return description;
    }
    
    /**
     * Fügt passende Klassen-Präfixe hinzu
     * @private
     */
    private static addClassPrefix(description: string): string {
        const lower = description.toLowerCase();
        
        if (lower.includes('verwalt')) {
            return `Service zur ${description}`;
        } else if (lower.includes('verarbeit') || lower.includes('prozess')) {
            return `Komponente zur ${description}`;
        } else if (lower.includes('hilfs') || lower.includes('util')) {
            return `Utility-Klasse für ${description}`;
        } else if (lower.includes('daten') || lower.includes('model')) {
            return `Datenmodell für ${description}`;
        }
        
        return description;
    }
    
    /**
     * Generiert JSDoc-Tags basierend auf Code-Analyse
     * @private
     */
    private static generateJSDocTags(analysis: any): string[] {
        const tags: string[] = [];
        
        // @class Tag
        if (analysis.type === 'class') {
            tags.push('@class');
        }
        
        // @async Tag
        if (analysis.isAsync) {
            tags.push('@async');
        }
        
        // @param Tags
        if (analysis.params.length > 0) {
            analysis.params.forEach((param: any) => {
                const type = this.inferParamType(param.name);
                tags.push(`@param {${type}} ${param.name} - ${this.generateParamDescription(param.name)}`);
            });
        }
        
        // @returns Tag
        if (analysis.hasReturn || analysis.isAsync) {
            const returnType = analysis.isAsync ? 'Promise' : this.inferReturnType(analysis);
            tags.push(`@returns {${returnType}} ${this.generateReturnDescription(analysis)}`);
        }
        
        return tags;
    }
    
    /**
     * Leitet Parameter-Typ ab
     * @private
     */
    private static inferParamType(paramName: string): string {
        const lower = paramName.toLowerCase();
        
        if (lower.includes('id')) return 'number|string';
        if (lower.includes('name')) return 'string';
        if (lower.includes('data')) return 'Object';
        if (lower.includes('list') || lower.includes('items')) return 'Array';
        if (lower.includes('is') || lower.includes('has')) return 'boolean';
        if (lower.includes('count') || lower.includes('index')) return 'number';
        if (lower.includes('callback') || lower.includes('fn')) return 'Function';
        
        return '*'; // Generic type
    }
    
    /**
     * Generiert Parameter-Beschreibung
     * @private
     */
    private static generateParamDescription(paramName: string): string {
        const lower = paramName.toLowerCase();
        
        if (lower.includes('id')) return 'Eindeutige Identifikation';
        if (lower.includes('name')) return 'Name';
        if (lower.includes('data')) return 'Daten-Objekt';
        if (lower.includes('url')) return 'URL-Adresse';
        if (lower.includes('config')) return 'Konfigurationsobjekt';
        if (lower.includes('options')) return 'Optionen';
        if (lower.includes('callback')) return 'Callback-Funktion';
        
        return 'Parameter';
    }
    
    /**
     * Leitet Return-Typ ab
     * @private
     */
    private static inferReturnType(analysis: any): string {
        if (analysis.name.toLowerCase().includes('get')) return 'Object';
        if (analysis.name.toLowerCase().includes('is')) return 'boolean';
        if (analysis.name.toLowerCase().includes('has')) return 'boolean';
        if (analysis.name.toLowerCase().includes('find')) return 'Object|null';
        if (analysis.name.toLowerCase().includes('list')) return 'Array';
        if (analysis.name.toLowerCase().includes('count')) return 'number';
        
        return 'void';
    }
    
    /**
     * Generiert Return-Beschreibung
     * @private
     */
    private static generateReturnDescription(analysis: any): string {
        if (analysis.isAsync) return 'Promise mit Ergebnis';
        if (analysis.name.toLowerCase().includes('get')) return 'Abgerufene Daten';
        if (analysis.name.toLowerCase().includes('create')) return 'Erstelltes Objekt';
        if (analysis.name.toLowerCase().includes('update')) return 'Aktualisiertes Objekt';
        if (analysis.name.toLowerCase().includes('delete')) return 'Erfolgsstatus';
        if (analysis.name.toLowerCase().includes('is')) return 'Boolean-Wert';
        if (analysis.name.toLowerCase().includes('find')) return 'Gefundenes Element';
        
        return 'Ergebnis';
    }
    
    /**
     * Formatiert finalen Kommentar basierend auf Sprache
     * @private
     */
    private static formatFinalComment(
        description: string,
        tags: string[],
        languageId: string
    ): string {
        if (languageId === 'python') {
            return this.formatPythonComment(description, tags);
        }
        
        // JavaScript/TypeScript Format
        if (tags.length === 0) {
            // Einzeilig wenn keine Tags
            return `/** ${description} */`;
        }
        
        // Mehrzeilig mit Tags
        const lines = [
            '/**',
            ` * ${description}`,
            ' *'
        ];
        
        tags.forEach(tag => {
            lines.push(` * ${tag}`);
        });
        
        lines.push(' */');
        
        return lines.join('\n');
    }
    
    /**
     * Formatiert Python-Kommentar
     * @private
     */
    private static formatPythonComment(description: string, tags: string[]): string {
        if (tags.length === 0) {
            return `"""${description}"""`;
        }
        
        const lines = [
            '"""',
            description,
            ''
        ];
        
        // Konvertiere JSDoc zu Python docstring
        tags.forEach(tag => {
            if (tag.startsWith('@param')) {
                const match = tag.match(/@param\s+{(.+?)}\s+(\w+)\s+-\s+(.+)/);
                if (match) {
                    lines.push(`Args:`);
                    lines.push(`    ${match[2]} (${match[1]}): ${match[3]}`);
                }
            } else if (tag.startsWith('@returns')) {
                const match = tag.match(/@returns\s+{(.+?)}\s+(.+)/);
                if (match) {
                    lines.push(`Returns:`);
                    lines.push(`    ${match[1]}: ${match[2]}`);
                }
            }
        });
        
        lines.push('"""');
        
        return lines.join('\n');
    }
}
