/**
 * 🔍 Validiert Qualität von generierten Kommentaren
 * 
 * Prüft:
 * - Länge und Informationsgehalt
 * - Keine Meta-Beschreibungen
 * - Keine Redundanz mit Code
 * - Sinnvoller Inhalt
 * - Sprachqualität
 */
export class CommentQualityValidator {
    
    /**
     * Validiert einen generierten Kommentar
     */
    static validate(
        comment: string,
        code: string,
        functionName: string,
        languageId: string
    ): ValidationResult {
        const issues: ValidationIssue[] = [];
        let score = 100;
        
        // 1. Längen-Checks
        const lengthIssues = this.checkLength(comment);
        issues.push(...lengthIssues);
        score -= lengthIssues.length * 10;
        
        // 2. Meta-Beschreibungen vermeiden
        const metaIssues = this.checkMetaDescriptions(comment);
        issues.push(...metaIssues);
        score -= metaIssues.length * 15;
        
        // 3. Redundanz mit Code
        const redundancyScore = this.checkRedundancy(comment, code, functionName);
        if (redundancyScore > 0.5) {
            issues.push({
                type: 'redundancy',
                severity: 'medium',
                message: 'Kommentar wiederholt nur den Code',
                suggestion: 'Erkläre das "Warum" und "Was", nicht das "Wie"'
            });
            score -= 25;
        }
        
        // 4. Erklärt Zweck/Grund?
        if (!this.explainsWhy(comment)) {
            issues.push({
                type: 'missing-why',
                severity: 'low',
                message: 'Kommentar erklärt nicht das "Warum"',
                suggestion: 'Füge Kontext hinzu: Warum existiert diese Funktion?'
            });
            score -= 10;
        }
        
        // 5. Generischer Inhalt
        if (this.isGeneric(comment, functionName)) {
            issues.push({
                type: 'generic',
                severity: 'high',
                message: 'Kommentar ist zu generisch',
                suggestion: 'Sei spezifischer über die Funktion'
            });
            score -= 20;
        }
        
        // 6. Sprach-Qualität
        const languageIssues = this.checkLanguageQuality(comment);
        issues.push(...languageIssues);
        score -= languageIssues.length * 5;
        
        score = Math.max(0, score);
        
        return {
            isValid: score >= 60 && issues.filter(i => i.severity === 'high').length === 0,
            score,
            issues,
            recommendation: this.getRecommendation(score, issues)
        };
    }
    
    /**
     * Prüft Kommentar-Länge
     */
    private static checkLength(comment: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const cleaned = this.cleanComment(comment);
        
        if (cleaned.length < 20) {
            issues.push({
                type: 'too-short',
                severity: 'high',
                message: 'Kommentar zu kurz (< 20 Zeichen)',
                suggestion: 'Füge mehr Details hinzu'
            });
        }
        
        if (cleaned.length > 300) {
            issues.push({
                type: 'too-long',
                severity: 'medium',
                message: 'Kommentar zu lang (> 300 Zeichen)',
                suggestion: 'Kürze auf wesentliche Information'
            });
        }
        
        return issues;
    }
    
    /**
     * Prüft auf Meta-Beschreibungen
     */
    private static checkMetaDescriptions(comment: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const lower = comment.toLowerCase();
        
        const metaPhrases = [
            'dieser code',
            'diese funktion',
            'diese methode',
            'dieser abschnitt',
            'hier wird',
            'es wird',
            'dies ist',
            'das ist eine funktion',
            'diese klasse',
            'dieser block'
        ];
        
        for (const phrase of metaPhrases) {
            if (lower.includes(phrase)) {
                issues.push({
                    type: 'meta-description',
                    severity: 'high',
                    message: `Enthält Meta-Phrase: "${phrase}"`,
                    suggestion: 'Beschreibe direkt was der Code tut, nicht dass es Code ist'
                });
                break; // Nur ein Issue für Meta-Beschreibungen
            }
        }
        
        return issues;
    }
    
    /**
     * Berechnet Redundanz mit Code (0-1)
     */
    private static checkRedundancy(comment: string, code: string, functionName: string): number {
        // Normalisiere beide Texte
        const normalizedComment = this.normalize(comment);
        const normalizedCode = this.normalize(code);
        const normalizedFunctionName = this.normalize(functionName);
        
        // Wenn Kommentar nur Funktionsname ist
        if (normalizedComment === normalizedFunctionName) {
            return 1.0;
        }
        
        // Berechne Überlappung der Wörter
        const commentWords = new Set(normalizedComment.split(/\s+/).filter(w => w.length > 3));
        const codeWords = new Set(normalizedCode.split(/\s+/).filter(w => w.length > 3));
        
        if (commentWords.size === 0) {
            return 0;
        }
        
        let overlap = 0;
        for (const word of commentWords) {
            if (codeWords.has(word)) {
                overlap++;
            }
        }
        
        return overlap / commentWords.size;
    }
    
    /**
     * Prüft ob Kommentar das "Warum" erklärt
     */
    private static explainsWhy(comment: string): boolean {
        const lower = comment.toLowerCase();
        
        const whyIndicators = [
            'weil', 'damit', 'um zu', 'deshalb', 'daher', 'dafür',
            'zweck', 'ziel', 'grund', 'benötigt', 'erforderlich',
            'ermöglicht', 'verhindert', 'vermeidet', 'sichert',
            'gewährleistet', 'garantiert', 'stellt sicher',
            // Englisch
            'because', 'to', 'for', 'since', 'ensures', 'prevents',
            'enables', 'guarantees', 'purpose', 'goal', 'reason'
        ];
        
        return whyIndicators.some(indicator => lower.includes(indicator));
    }
    
    /**
     * Prüft ob Kommentar zu generisch ist
     */
    private static isGeneric(comment: string, functionName: string): boolean {
        const lower = comment.toLowerCase();
        
        const genericPhrases = [
            'funktion',
            'methode',
            'führt aus',
            'macht etwas',
            'verarbeitet daten',
            'behandelt',
            'kümmert sich um',
            // Englisch
            'function',
            'method',
            'does something',
            'handles',
            'processes'
        ];
        
        // Wenn Kommentar hauptsächlich generische Phrasen enthält
        const words = lower.split(/\s+/);
        const genericCount = words.filter(word => 
            genericPhrases.some(phrase => phrase.includes(word))
        ).length;
        
        return genericCount > words.length * 0.5;
    }
    
    /**
     * Prüft Sprach-Qualität
     */
    private static checkLanguageQuality(comment: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        
        // Doppelte Leerzeichen
        if (comment.includes('  ')) {
            issues.push({
                type: 'double-spaces',
                severity: 'low',
                message: 'Enthält doppelte Leerzeichen',
                suggestion: 'Formatierung korrigieren'
            });
        }
        
        // Endet nicht mit Punkt/Fragezeichen/Ausrufezeichen
        const cleaned = this.cleanComment(comment);
        if (cleaned.length > 0 && !/[.!?]$/.test(cleaned.trim())) {
            issues.push({
                type: 'missing-punctuation',
                severity: 'low',
                message: 'Satz endet nicht mit Satzzeichen',
                suggestion: 'Füge abschließendes Satzzeichen hinzu'
            });
        }
        
        return issues;
    }
    
    /**
     * Gibt Empfehlung basierend auf Score
     */
    private static getRecommendation(score: number, issues: ValidationIssue[]): string {
        if (score >= 80) {
            return 'Gute Qualität - Kommentar kann verwendet werden';
        }
        
        if (score >= 60) {
            return 'Akzeptable Qualität - Kleinere Verbesserungen möglich';
        }
        
        if (score >= 40) {
            return 'Niedrige Qualität - Überarbeitung empfohlen';
        }
        
        return 'Schlechte Qualität - Kommentar sollte neu generiert werden';
    }
    
    /**
     * Bereinigt Kommentar von Syntax
     */
    private static cleanComment(comment: string): string {
        return comment
            .replace(/^\/\/\s*/, '')
            .replace(/^\/\*+\s*/, '')
            .replace(/\*+\/\s*$/, '')
            .replace(/^\*\s*/gm, '')
            .replace(/^"""\s*/, '')
            .replace(/"""\s*$/, '')
            .trim();
    }
    
    /**
     * Normalisiert Text für Vergleich
     */
    private static normalize(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    /**
     * Verbessert einen Kommentar basierend auf Issues
     */
    static improve(comment: string, issues: ValidationIssue[]): string {
        let improved = comment;
        
        for (const issue of issues) {
            switch (issue.type) {
                case 'double-spaces':
                    improved = improved.replace(/\s+/g, ' ');
                    break;
                    
                case 'missing-punctuation':
                    const cleaned = this.cleanComment(improved);
                    if (!/[.!?]$/.test(cleaned)) {
                        improved = improved.trim() + '.';
                    }
                    break;
            }
        }
        
        return improved;
    }
}

/**
 * Validierungs-Ergebnis
 */
export interface ValidationResult {
    isValid: boolean;
    score: number;
    issues: ValidationIssue[];
    recommendation: string;
}

/**
 * Validierungs-Problem
 */
export interface ValidationIssue {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion: string;
}
