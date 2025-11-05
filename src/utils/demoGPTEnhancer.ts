/**
 * Demo-Modus für GPT-basierte Kommentar-Verbesserung
 * Simuliert intelligente KI-Verbesserungen ohne echten API-Key
 */
export class DemoGPTEnhancer {
    
    /**
     * Verbessert Text wie GPT es tun würde - für Demo-Zwecke
     */
    public static enhanceComment(originalText: string, codeContext?: string): string {
        // Bereinige zuerst den Text
        let enhanced = this.cleanText(originalText);
        
        // Füge technische Präzision hinzu
        enhanced = this.addTechnicalPrecision(enhanced);
        
        // Verbessere die Struktur
        enhanced = this.improveStructure(enhanced);
        
        return enhanced;
    }

    private static cleanText(text: string): string {
        return text
            .trim()
            .replace(/\s+/g, ' ')
            // Entferne Füllwörter
            .replace(/^(äh|ähm|also|ja|okay|ok|hmm)\s*/gi, '')
            .replace(/\s+(äh|ähm|also)\s+/gi, ' ')
            .replace(/[.,;:!?]+$/, '');
    }

    private static addTechnicalPrecision(text: string): string {
        const improvements: { [key: string]: string } = {
            'macht': 'führt aus',
            'tut': 'verarbeitet',
            'funktion': 'Funktion',
            'methode': 'Methode',
            'klasse': 'Klasse',
            'variable': 'Variable',
            'array': 'Array',
            'objekt': 'Objekt',
            'datenbank': 'Datenbank',
            'api': 'API',
        };

        let result = text;
        for (const [old, improved] of Object.entries(improvements)) {
            const regex = new RegExp(`\\b${old}\\b`, 'gi');
            result = result.replace(regex, improved);
        }

        return result;
    }

    private static improveStructure(text: string): string {
        // Entferne redundante Anfänge
        text = text.replace(/^(diese|die|der|das)\s+(funktion|methode)\s+(macht|tut)/i, '');
        text = text.replace(/^hier\s+/i, '');
        
        // Großbuchstabe am Anfang
        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        return text;
    }
}
