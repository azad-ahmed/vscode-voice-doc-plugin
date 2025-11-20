import * as vscode from 'vscode';
import { CodeContext, CodeContextAnalyzer } from './codeContextAnalyzer';
import { FeedbackManager, CommentFeedback } from './feedbackManager';

/**
 * Adaptive Learning Engine - Lernt aus Feedback und verbessert Kommentar-Generierung
 */
export class AdaptiveLearningEngine {
    private templates: Map<string, CommentTemplate[]> = new Map();
    private contextAnalyzer: CodeContextAnalyzer;
    private feedbackManager: FeedbackManager;
    
    // Konfiguration
    private readonly MIN_EXAMPLES_FOR_LEARNING = 3;
    private readonly TEMPLATE_CONFIDENCE_THRESHOLD = 0.6;
    
    constructor(
        private context: vscode.ExtensionContext,
        feedbackManager: FeedbackManager
    ) {
        this.contextAnalyzer = new CodeContextAnalyzer();
        this.feedbackManager = feedbackManager;
        this.initializeTemplates();
    }
    
    /**
     * Hauptmethode: Verbessert einen transkribierten Text basierend auf gelernten Patterns
     */
    async improveComment(
        transcript: string,
        codeContext: CodeContext,
        useOnlineAPI: boolean = true
    ): Promise<ImprovedComment> {
        console.log('🧠 Adaptive Learning: Improving comment...');
        
        // 1. Hole ähnliche positive Beispiele
        const similarExamples = this.feedbackManager.findSimilarFeedback(
            codeContext,
            0.5, // min similarity
            5    // top 5
        ).filter(f => f.rating === 'good');
        
        // 2. Wähle bestes Template
        const template = await this.selectBestTemplate(codeContext, similarExamples);
        
        // 3. Generiere Kommentar
        let improvedText: string;
        let confidence: number;
        let method: 'template' | 'learned' | 'fallback';
        
        if (template && template.confidence >= this.TEMPLATE_CONFIDENCE_THRESHOLD) {
            // Nutze gelerntes Template
            improvedText = this.applyTemplate(transcript, template, codeContext);
            confidence = template.confidence;
            method = 'learned';
            console.log('✅ Using learned template');
        } else if (similarExamples.length >= this.MIN_EXAMPLES_FOR_LEARNING) {
            // Lerne aus ähnlichen Beispielen
            improvedText = this.learnFromExamples(transcript, similarExamples, codeContext);
            confidence = 0.7;
            method = 'learned';
            console.log('✅ Learning from similar examples');
        } else {
            // Fallback: Basis-Verbesserung
            improvedText = this.basicImprovement(transcript, codeContext);
            confidence = 0.5;
            method = 'fallback';
            console.log('⚠️ Using fallback improvement');
        }
        
        return {
            improvedText,
            originalText: transcript,
            confidence,
            method,
            templateUsed: template?.id,
            similarExamplesFound: similarExamples.length
        };
    }
    
    /**
     * Wählt das beste Template für den aktuellen Kontext
     */
    private async selectBestTemplate(
        context: CodeContext,
        examples: CommentFeedback[]
    ): Promise<CommentTemplate | null> {
        const templateKey = this.getTemplateKey(context);
        const templates = this.templates.get(templateKey) || [];
        
        if (templates.length === 0 && examples.length > 0) {
            // Erstelle neues Template aus Beispielen
            return this.createTemplateFromExamples(examples, context);
        }
        
        // Sortiere nach Confidence und Nutzung
        const sortedTemplates = templates.sort((a, b) => {
            const scoreA = a.confidence * 0.7 + (a.usageCount / 100) * 0.3;
            const scoreB = b.confidence * 0.7 + (b.usageCount / 100) * 0.3;
            return scoreB - scoreA;
        });
        
        return sortedTemplates[0] || null;
    }
    
    /**
     * Wendet ein Template auf den Transcript an
     */
    private applyTemplate(
        transcript: string,
        template: CommentTemplate,
        context: CodeContext
    ): string {
        let result = template.pattern;
        
        // Ersetze Platzhalter
        result = result.replace('{DESCRIPTION}', transcript);
        
        if (context.pattern.name) {
            result = result.replace('{NAME}', context.pattern.name);
        }
        
        if (context.codeElement.parameters && context.codeElement.parameters.length > 0) {
            result = result.replace(
                '{PARAMETERS}',
                context.codeElement.parameters.join(', ')
            );
        }
        
        if (context.codeElement.returnType) {
            result = result.replace('{RETURN_TYPE}', context.codeElement.returnType);
        }
        
        // Bereinige nicht-ersetzte Platzhalter
        result = result.replace(/\{[A-Z_]+\}/g, '');
        
        // Update Template-Statistik
        template.usageCount++;
        template.lastUsed = Date.now();
        
        return this.formatComment(result);
    }
    
    /**
     * Lernt aus ähnlichen positiven Beispielen
     */
    private learnFromExamples(
        transcript: string,
        examples: CommentFeedback[],
        context: CodeContext
    ): string {
        // Analysiere gemeinsame Muster in guten Beispielen
        const patterns = this.extractCommonPatterns(examples);
        
        // Baue Kommentar basierend auf Patterns
        let improved = transcript;
        
        // 1. Füge häufige Präfixe hinzu
        if (patterns.commonPrefixes.length > 0) {
            const prefix = patterns.commonPrefixes[0];
            if (!improved.toLowerCase().startsWith(prefix.toLowerCase())) {
                improved = `${prefix} ${improved}`;
            }
        }
        
        // 2. Erwähne Parameter wenn vorhanden
        if (context.codeElement.hasParameters && patterns.mentionsParameters) {
            if (context.codeElement.parameters) {
                improved += ` Parameters: ${context.codeElement.parameters.join(', ')}`;
            }
        }
        
        // 3. Erwähne Return-Type wenn vorhanden
        if (context.codeElement.hasReturnType && patterns.mentionsReturn) {
            improved += ` Returns: ${context.codeElement.returnType || 'value'}`;
        }
        
        return this.formatComment(improved);
    }
    
    /**
     * Extrahiert gemeinsame Muster aus Beispielen
     */
    private extractCommonPatterns(examples: CommentFeedback[]): CommentPatterns {
        const patterns: CommentPatterns = {
            commonPrefixes: [],
            commonSuffixes: [],
            averageLength: 0,
            mentionsParameters: false,
            mentionsReturn: false,
            usesJSDoc: false
        };
        
        // Analysiere Präfixe
        const prefixes = examples
            .map(e => {
                const words = e.generatedComment.trim().split(/\s+/);
                return words.slice(0, 2).join(' ');
            })
            .filter((p, i, arr) => arr.indexOf(p) === i);
        
        // Finde häufigsten Präfix
        const prefixCounts = new Map<string, number>();
        prefixes.forEach(p => {
            prefixCounts.set(p, (prefixCounts.get(p) || 0) + 1);
        });
        
        patterns.commonPrefixes = Array.from(prefixCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([prefix]) => prefix)
            .slice(0, 3);
        
        // Durchschnittliche Länge
        patterns.averageLength = Math.round(
            examples.reduce((sum, e) => sum + e.generatedComment.length, 0) / examples.length
        );
        
        // Prüfe ob Parameter/Return erwähnt werden
        patterns.mentionsParameters = examples.some(e =>
            /param|parameter|arg/i.test(e.generatedComment)
        );
        patterns.mentionsReturn = examples.some(e =>
            /return|returns|gibt zurück/i.test(e.generatedComment)
        );
        patterns.usesJSDoc = examples.some(e =>
            e.generatedComment.includes('@param') || e.generatedComment.includes('@returns')
        );
        
        return patterns;
    }
    
    /**
     * Basis-Verbesserung ohne Lernen (Fallback)
     */
    private basicImprovement(transcript: string, context: CodeContext): string {
        let improved = transcript.trim();
        
        // 1. Stelle sicher, dass es mit Großbuchstaben beginnt
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);
        
        // 2. Füge Punkt am Ende hinzu wenn fehlend
        if (!/[.!?]$/.test(improved)) {
            improved += '.';
        }
        
        // 3. Füge Kontext hinzu basierend auf Pattern
        const contextPrefix = this.getContextPrefix(context.pattern.type);
        if (contextPrefix && !improved.toLowerCase().startsWith(contextPrefix.toLowerCase())) {
            improved = `${contextPrefix} ${improved}`;
        }
        
        return improved;
    }
    
    /**
     * Holt Kontext-abhängigen Präfix
     */
    private getContextPrefix(patternType: string): string {
        const prefixes: { [key: string]: string } = {
            'function': 'Funktion:',
            'method': 'Methode:',
            'class': 'Klasse:',
            'interface': 'Interface:',
            'variable': 'Variable:',
            'arrow-function': 'Arrow Function:'
        };
        
        return prefixes[patternType] || '';
    }
    
    /**
     * Formatiert Kommentar (Cleanup)
     */
    private formatComment(text: string): string {
        return text
            .trim()
            .replace(/\s+/g, ' ')  // Mehrfache Leerzeichen entfernen
            .replace(/\s+\./g, '.') // Leerzeichen vor Punkt entfernen
            .replace(/\s+,/g, ','); // Leerzeichen vor Komma entfernen
    }
    
    /**
     * Erstellt Template aus Beispielen
     */
    private createTemplateFromExamples(
        examples: CommentFeedback[],
        context: CodeContext
    ): CommentTemplate {
        const patterns = this.extractCommonPatterns(examples);
        
        // Baue Template-Pattern
        let pattern = '{DESCRIPTION}';
        
        if (patterns.mentionsParameters) {
            pattern += ' Parameters: {PARAMETERS}';
        }
        
        if (patterns.mentionsReturn) {
            pattern += ' Returns: {RETURN_TYPE}';
        }
        
        const template: CommentTemplate = {
            id: this.generateTemplateId(),
            pattern,
            confidence: Math.min(0.9, 0.5 + (examples.length * 0.1)),
            context: {
                languageId: context.languageId,
                patternType: context.pattern.type
            },
            createdFrom: examples.length,
            usageCount: 0,
            lastUsed: Date.now()
        };
        
        // Speichere Template
        const key = this.getTemplateKey(context);
        if (!this.templates.has(key)) {
            this.templates.set(key, []);
        }
        this.templates.get(key)!.push(template);
        
        console.log(`✨ Created new template: ${template.id}`);
        
        return template;
    }
    
    /**
     * Generiert Template-Key basierend auf Kontext
     */
    private getTemplateKey(context: CodeContext): string {
        return `${context.languageId}:${context.pattern.type}`;
    }
    
    /**
     * Initialisiert Standard-Templates
     */
    private initializeTemplates(): void {
        // TypeScript/JavaScript Function
        this.addDefaultTemplate('typescript', 'function', 
            '{DESCRIPTION}. Parameters: {PARAMETERS}');
        
        // Python Function
        this.addDefaultTemplate('python', 'function',
            '{DESCRIPTION}. Args: {PARAMETERS}. Returns: {RETURN_TYPE}');
        
        // Class
        this.addDefaultTemplate('typescript', 'class',
            'Klasse: {DESCRIPTION}');
        
        console.log(`Initialized ${this.templates.size} default templates`);
    }
    
    /**
     * Fügt Standard-Template hinzu
     */
    private addDefaultTemplate(
        languageId: string,
        patternType: string,
        pattern: string
    ): void {
        const key = `${languageId}:${patternType}`;
        if (!this.templates.has(key)) {
            this.templates.set(key, []);
        }
        
        this.templates.get(key)!.push({
            id: this.generateTemplateId(),
            pattern,
            confidence: 0.6,
            context: { languageId, patternType },
            createdFrom: 0,
            usageCount: 0,
            lastUsed: Date.now()
        });
    }
    
    /**
     * Generiert eindeutige Template-ID
     */
    private generateTemplateId(): string {
        return `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }
    
    /**
     * Holt Statistiken
     */
    getStatistics(): LearningStatistics {
        const feedbackStats = this.feedbackManager.getStatistics();
        
        let totalTemplates = 0;
        let totalUsage = 0;
        
        this.templates.forEach(templates => {
            totalTemplates += templates.length;
            totalUsage += templates.reduce((sum, t) => sum + t.usageCount, 0);
        });
        
        return {
            totalTemplates,
            totalTemplateUsage: totalUsage,
            feedbackCount: feedbackStats.total,
            successRate: feedbackStats.successRate,
            languageStats: feedbackStats.byLanguage,
            recentSuccessRate: feedbackStats.recentSuccessRate
        };
    }
}

// ===== INTERFACES =====

export interface ImprovedComment {
    improvedText: string;
    originalText: string;
    confidence: number;
    method: 'template' | 'learned' | 'fallback';
    templateUsed?: string;
    similarExamplesFound: number;
}

export interface CommentTemplate {
    id: string;
    pattern: string;
    confidence: number;
    context: {
        languageId: string;
        patternType: string;
    };
    createdFrom: number;  // Anzahl Beispiele
    usageCount: number;
    lastUsed: number;
}

interface CommentPatterns {
    commonPrefixes: string[];
    commonSuffixes: string[];
    averageLength: number;
    mentionsParameters: boolean;
    mentionsReturn: boolean;
    usesJSDoc: boolean;
}

export interface LearningStatistics {
    totalTemplates: number;
    totalTemplateUsage: number;
    feedbackCount: number;
    successRate: number;
    languageStats: any;
    recentSuccessRate: number;
}
