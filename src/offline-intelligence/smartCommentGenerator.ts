import { CodeStructure, FunctionParameter } from './astAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Intelligenter Kommentar-Generator - OFFLINE!
 * 
 * Generiert professionelle Kommentare basierend auf:
 * - AST-Analyse (Code-Struktur)
 * - User-Input (Voice/Text)
 * - Pattern-Matching
 * - Fachliche Begriffe
 * 
 * Kein API-Call nötig - komplett lokal!
 */
export class SmartCommentGenerator {

    /**
     * Generiert intelligenten Kommentar basierend auf Code-Struktur und User-Input
     */
    static generateComment(
        structure: CodeStructure,
        userInput: string,
        languageId: string
    ): string {
        ErrorHandler.log('SmartGenerator', `Generiere Kommentar für ${structure.type}: ${structure.name}`);

        // Bereinige und verbessere User-Input
        const enhancedInput = this.enhanceUserInput(userInput, structure);

        // Generiere sprachspezifischen Kommentar
        switch (structure.type) {
            case 'function':
            case 'arrow-function':
            case 'function-variable':
                return this.generateFunctionComment(structure, enhancedInput, languageId);
            
            case 'method':
                return this.generateMethodComment(structure, enhancedInput, languageId);
            
            case 'class':
                return this.generateClassComment(structure, enhancedInput, languageId);
            
            case 'interface':
                return this.generateInterfaceComment(structure, enhancedInput, languageId);
            
            case 'variable':
                return this.generateVariableComment(structure, enhancedInput, languageId);
            
            default:
                return this.generateGenericComment(enhancedInput, languageId, structure.indentation);
        }
    }

    /**
     */
    private static enhanceUserInput(input: string, structure: CodeStructure): string {
        let enhanced = input.trim();

        // Großschreibung am Anfang
        if (enhanced.length > 0) {
            enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
        }

        // Füge Punkt hinzu falls nicht vorhanden
        if (!enhanced.match(/[.!?]$/)) {
            enhanced += '.';
        }

        // Ersetze umgangssprachliche Begriffe
        enhanced = this.replaceCasualTerms(enhanced);

        // Ergänze technische Details basierend auf Struktur
        enhanced = this.addTechnicalContext(enhanced, structure);

        return enhanced;
    }

    /**
     * Ersetzt umgangssprachliche durch fachliche Begriffe
     */
    private static replaceCasualTerms(text: string): string {
        const replacements: [RegExp, string][] = [
            [/\bmacht\b/gi, 'führt aus'],
            [/\btut\b/gi, 'führt aus'],
            [/\bgibt zurück\b/gi, 'gibt zurück'],
            [/\bbekommt\b/gi, 'empfängt'],
            [/\bholt\b/gi, 'lädt'],
            [/\bzeigt\b/gi, 'gibt aus'],
            [/\bspeichert ab\b/gi, 'persistiert'],
            [/\bprüft ob\b/gi, 'validiert ob'],
            [/\bschaut ob\b/gi, 'prüft ob'],
            [/\bguckt ob\b/gi, 'prüft ob'],
            [/\brechnet aus\b/gi, 'berechnet'],
            [/\bsorgt dafür\b/gi, 'stellt sicher'],
            [/\bkann man\b/gi, 'ermöglicht'],
            [/\bmuss man\b/gi, 'erfordert']
        ];

        let result = text;
        for (const [pattern, replacement] of replacements) {
            result = result.replace(pattern, replacement);
        }

        return result;
    }

    /**
     * Fügt technischen Kontext basierend auf Code-Struktur hinzu
     */
    private static addTechnicalContext(text: string, structure: CodeStructure): string {
        let enhanced = text;

        // Async-Funktionen
        if (structure.isAsync && !text.toLowerCase().includes('async')) {
            enhanced = `Asynchron: ${enhanced}`;
        }

        // Hohe Komplexität
        if (structure.complexity > 10) {
            if (!text.toLowerCase().includes('komplex')) {
                enhanced += ' (Hohe Komplexität)';
            }
        }

        return enhanced;
    }

    /**
     * Generiert Funktions-Kommentar
     */
    private static generateFunctionComment(
        structure: CodeStructure,
        description: string,
        languageId: string
    ): string {
        if (languageId === 'python') {
            return this.generatePythonDocstring(structure, description);
        }

        // JSDoc-Style für TypeScript/JavaScript
        const lines: string[] = ['/**'];
        
        // Haupt-Beschreibung
        lines.push(` * ${description}`);
        
        // Leerzeile falls Parameter folgen
        if (structure.parameters.length > 0 || structure.returnType) {
            lines.push(' *');
        }

        // Parameter-Dokumentation
        for (const param of structure.parameters) {
            const optional = param.optional ? ' (optional)' : '';
            const defaultVal = param.defaultValue ? ` - Default: ${param.defaultValue}` : '';
            const typeInfo = param.type !== 'any' ? ` {${param.type}}` : '';
            
            lines.push(` * @param${typeInfo} ${param.name}${optional}${defaultVal}`);
        }

        // Return-Dokumentation
        if (structure.returnType && structure.returnType !== 'void') {
            const returnDesc = this.inferReturnDescription(structure.name, structure.returnType);
            lines.push(` * @returns {${structure.returnType}} ${returnDesc}`);
        }

        // Async-Hinweis
        if (structure.isAsync) {
            lines.push(' * @async');
        }

        // Komplexitäts-Warnung
        if (structure.complexity > 15) {
            lines.push(` * @complexity ${structure.complexity} (Hoch - Refactoring empfohlen)`);
        }

        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * Generiert Methoden-Kommentar
     */
    private static generateMethodComment(
        structure: CodeStructure,
        description: string,
        languageId: string
    ): string {
        if (languageId === 'python') {
            return this.generatePythonDocstring(structure, description);
        }

        const lines: string[] = ['/**'];
        
        // Haupt-Beschreibung mit Klassen-Kontext
        if (structure.className) {
            lines.push(` * ${description}`);
            lines.push(` * @memberof ${structure.className}`);
        } else {
            lines.push(` * ${description}`);
        }

        // Sichtbarkeit
        if (structure.scope === 'private') {
            lines.push(' * @private');
        } else if (structure.scope === 'protected') {
            lines.push(' * @protected');
        }

        // Static
        if (structure.isStatic) {
            lines.push(' * @static');
        }

        if (structure.parameters.length > 0 || structure.returnType) {
            lines.push(' *');
        }

        // Parameter
        for (const param of structure.parameters) {
            const optional = param.optional ? ' (optional)' : '';
            const typeInfo = param.type !== 'any' ? ` {${param.type}}` : '';
            lines.push(` * @param${typeInfo} ${param.name}${optional}`);
        }

        // Return
        if (structure.returnType && structure.returnType !== 'void') {
            lines.push(` * @returns {${structure.returnType}}`);
        }

        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * Generiert Klassen-Kommentar
     */
    private static generateClassComment(
        structure: CodeStructure,
        description: string,
        languageId: string
    ): string {
        if (languageId === 'python') {
            return this.generatePythonDocstring(structure, description);
        }

        const lines: string[] = ['/**'];
        lines.push(` * ${description}`);
        
        // Abstract-Hinweis
        if (structure.isAbstract) {
            lines.push(' * @abstract');
        }

        // Methoden-Übersicht
        if (structure.methods && structure.methods.length > 0) {
            lines.push(' *');
            lines.push(` * @methods ${structure.methods.slice(0, 5).join(', ')}${structure.methods.length > 5 ? '...' : ''}`);
        }

        // Properties-Übersicht
        if (structure.properties && structure.properties.length > 0) {
            lines.push(` * @properties ${structure.properties.slice(0, 5).join(', ')}${structure.properties.length > 5 ? '...' : ''}`);
        }

        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * Generiert Interface-Kommentar
     */
    private static generateInterfaceComment(
        structure: CodeStructure,
        description: string,
        languageId: string
    ): string {
        const lines: string[] = ['/**'];
        lines.push(` * ${description}`);
        lines.push(' * @interface');
        lines.push(' */');
        return lines.join('\n');
    }

    /**
     * Generiert Variable-Kommentar
     */
    private static generateVariableComment(
        structure: CodeStructure,
        description: string,
        languageId: string
    ): string {
        if (languageId === 'python') {
            return `# ${description}`;
        }

        return `/** ${description} */`;
    }

    /**
     * Generiert generischen Kommentar
     */
    private static generateGenericComment(
        description: string,
        languageId: string,
        indentation: number
    ): string {
        if (languageId === 'python') {
            return `# ${description}`;
        }

        if (description.length > 50) {
            return `/**\n * ${description}\n */`;
        }

        return `/** ${description} */`;
    }

    /**
     * Generiert Python-Docstring
     */
    private static generatePythonDocstring(
        structure: CodeStructure,
        description: string
    ): string {
        const lines: string[] = ['"""'];
        lines.push(description);

        if (structure.parameters.length > 0) {
            lines.push('');
            lines.push('Args:');
            for (const param of structure.parameters) {
                const typeInfo = param.type !== 'any' ? ` (${param.type})` : '';
                const optional = param.optional ? ' (optional)' : '';
                lines.push(`    ${param.name}${typeInfo}${optional}: Parameter description`);
            }
        }

        if (structure.returnType && structure.returnType !== 'None') {
            lines.push('');
            lines.push('Returns:');
            lines.push(`    ${structure.returnType}: Return value description`);
        }

        lines.push('"""');
        return lines.join('\n');
    }

    /**
     * Leitet Return-Beschreibung aus Funktionsname ab
     */
    private static inferReturnDescription(functionName: string, returnType: string): string {
        const name = functionName.toLowerCase();

        // Pattern-Matching für häufige Funktions-Namen
        if (name.startsWith('get')) return 'Der abgerufene Wert';
        if (name.startsWith('is') || name.startsWith('has')) return 'Boolean-Wert';
        if (name.startsWith('calculate') || name.startsWith('compute')) return 'Das Berechnungsergebnis';
        if (name.startsWith('find')) return 'Das gefundene Element';
        if (name.startsWith('create')) return 'Das neu erstellte Objekt';
        if (name.startsWith('update')) return 'Das aktualisierte Objekt';
        if (name.startsWith('delete') || name.startsWith('remove')) return 'Bestätigung der Löschung';
        if (name.startsWith('validate')) return 'Validierungsergebnis';
        if (name.includes('count')) return 'Die Anzahl';
        if (name.includes('sum')) return 'Die Summe';
        if (name.includes('average') || name.includes('mean')) return 'Der Durchschnitt';
        if (name.includes('max')) return 'Der Maximalwert';
        if (name.includes('min')) return 'Der Minimalwert';

        // Fallback basierend auf Return-Type
        if (returnType === 'boolean' || returnType === 'Boolean') return 'Boolean-Wert';
        if (returnType === 'number' || returnType === 'Number') return 'Numerischer Wert';
        if (returnType === 'string' || returnType === 'String') return 'String-Wert';
        if (returnType.includes('Promise')) return 'Promise mit Ergebnis';
        if (returnType.includes('[]') || returnType.includes('Array')) return 'Array mit Elementen';

        return 'Der Rückgabewert';
    }

    /**
     * Generiert Beispiel-Code für Dokumentation
     */
    static generateExample(structure: CodeStructure): string {
        if (structure.type !== 'function' && structure.type !== 'method') {
            return '';
        }

        const exampleLines: string[] = [];
        exampleLines.push(' * @example');

        // Generiere Beispiel-Aufruf
        const params = structure.parameters.map(p => {
            // Generiere Beispiel-Werte basierend auf Type
            switch (p.type) {
                case 'string': return `"example"`;
                case 'number': return '42';
                case 'boolean': return 'true';
                case 'any': return '{}';
                default: return p.defaultValue || 'value';
            }
        }).join(', ');

        if (structure.type === 'method' && structure.className) {
            exampleLines.push(` * const instance = new ${structure.className}();`);
            exampleLines.push(` * const result = ${structure.isAsync ? 'await ' : ''}instance.${structure.name}(${params});`);
        } else {
            exampleLines.push(` * const result = ${structure.isAsync ? 'await ' : ''}${structure.name}(${params});`);
        }

        return exampleLines.join('\n');
    }
}