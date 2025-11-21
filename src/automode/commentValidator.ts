/**
 * ⚡ KRITISCHER FIX: Validiert und filtert Kommentare
 * Verhindert redundante und falsch platzierte Kommentare
 */

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    score: number;
}

export class CommentValidator {
    private static readonly MIN_LENGTH = 20;
    private static readonly MIN_WORDS = 5;
    private static readonly MAX_LENGTH = 500;
    
    // Blacklist: Diese Patterns sind KEINE validen Kommentare
    private static readonly INVALID_PATTERNS = [
        /erstelle?\s+einen/i,
        /generiere?/i,
        /schreibe?/i,
        /kommentar\s+für/i,
        /documentation\s+for/i,
        /method:/i,
        /function:/i,
        /class:/i,
        /der\s+kommentar\s+soll/i,
        /beschreibe?\s+was/i,
        /^(test|todo|fixme|hack)$/i,
        /lorem\s+ipsum/i
    ];

    /**
     * Validiert einen Kommentar-Text
     */
    static validate(text: string): ValidationResult {
        const trimmed = text.trim();
        
        // 1. Längen-Check
        if (trimmed.length < this.MIN_LENGTH) {
            return {
                isValid: false,
                reason: 'Zu kurz (min. 20 Zeichen)',
                score: 0
            };
        }

        if (trimmed.length > this.MAX_LENGTH) {
            return {
                isValid: false,
                reason: 'Zu lang (max. 500 Zeichen)',
                score: 0
            };
        }

        // 2. Wort-Count
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        if (words.length < this.MIN_WORDS) {
            return {
                isValid: false,
                reason: `Zu wenig Wörter (min. ${this.MIN_WORDS})`,
                score: 0
            };
        }

        // 3. Invalid Patterns
        for (const pattern of this.INVALID_PATTERNS) {
            if (pattern.test(trimmed)) {
                return {
                    isValid: false,
                    reason: 'Enthält Meta-Anweisungen',
                    score: 0
                };
            }
        }

        // 4. Qualitäts-Score berechnen
        let score = 50; // Basis

        // +Punkte für gute Eigenschaften
        if (this.startsWithVerb(trimmed)) score += 20;
        if (this.containsTechnicalTerms(trimmed)) score += 15;
        if (this.hasProperPunctuation(trimmed)) score += 10;
        if (words.length >= 10) score += 5;

        // -Punkte für schlechte Eigenschaften
        if (this.hasExcessivePunctuation(trimmed)) score -= 20;
        if (this.isGeneric(trimmed)) score -= 15;

        return {
            isValid: score >= 40,
            reason: score >= 40 ? undefined : 'Qualitätsscore zu niedrig',
            score: Math.max(0, Math.min(100, score))
        };
    }

    /**
     * Prüft ob Text mit einem Verb beginnt (gute Praxis)
     */
    private static startsWithVerb(text: string): boolean {
        const verbs = [
            'berechnet', 'erstellt', 'gibt', 'verwaltet', 'führt', 'prüft',
            'validiert', 'konvertiert', 'transformiert', 'lädt', 'speichert',
            'sendet', 'empfängt', 'initialisiert', 'startet', 'stoppt',
            'calculates', 'creates', 'returns', 'manages', 'performs', 'checks',
            'validates', 'converts', 'transforms', 'loads', 'saves',
            'sends', 'receives', 'initializes', 'starts', 'stops'
        ];

        const firstWord = text.toLowerCase().split(/\s+/)[0];
        return verbs.some(v => firstWord.startsWith(v));
    }

    /**
     * Prüft auf technische Begriffe
     */
    private static containsTechnicalTerms(text: string): boolean {
        const terms = [
            'funktion', 'methode', 'klasse', 'objekt', 'parameter', 'rückgabe',
            'daten', 'array', 'liste', 'wert', 'typ', 'interface',
            'function', 'method', 'class', 'object', 'parameter', 'return',
            'data', 'array', 'list', 'value', 'type', 'interface',
            'api', 'http', 'request', 'response', 'query', 'database'
        ];

        const lower = text.toLowerCase();
        return terms.some(term => lower.includes(term));
    }

    /**
     * Prüft korrekte Zeichensetzung
     */
    private static hasProperPunctuation(text: string): boolean {
        return /[.!?]$/.test(text);
    }

    /**
     * Prüft auf übermäßige Zeichensetzung
     */
    private static hasExcessivePunctuation(text: string): boolean {
        const punctCount = (text.match(/[!?]{2,}|\.{3,}/g) || []).length;
        return punctCount > 0;
    }

    /**
     * Prüft ob Kommentar zu generisch ist
     */
    private static isGeneric(text: string): boolean {
        const genericPhrases = [
            'macht etwas',
            'tut etwas',
            'führt aus',
            'does something',
            'performs action',
            'function here',
            'todo',
            'beschreibung'
        ];

        const lower = text.toLowerCase();
        return genericPhrases.some(phrase => lower.includes(phrase));
    }

    /**
     * Normalisiert Text für Vergleich (Duplikat-Erkennung)
     */
    static normalize(text: string): string {
        return text
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[.,!?;:]/g, '')
            .trim();
    }

    /**
     * Prüft Ähnlichkeit zweier Kommentare (0-1)
     */
    static similarity(text1: string, text2: string): number {
        const norm1 = this.normalize(text1);
        const norm2 = this.normalize(text2);

        if (norm1 === norm2) return 1.0;

        const words1 = new Set(norm1.split(/\s+/));
        const words2 = new Set(norm2.split(/\s+/));

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }
}
