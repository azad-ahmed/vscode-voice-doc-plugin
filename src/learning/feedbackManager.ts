import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeContext } from './codeContextAnalyzer';

/**
 * Verwaltet User-Feedback für generierte Kommentare
 */
export class FeedbackManager {
    private feedbackData: CommentFeedback[] = [];
    private storageFile: string;
    private readonly MAX_FEEDBACK_ITEMS = 1000;
    
    constructor(private context: vscode.ExtensionContext) {
        this.storageFile = path.join(
            this.context.globalStorageUri.fsPath,
            'feedback-data.json'
        );
        this.ensureStorageDirectory();
        this.loadFeedbackData();
    }
    
    /**
     * Registriert neues Feedback für einen Kommentar
     */
    async recordFeedback(feedback: CommentFeedback): Promise<void> {
        feedback.id = this.generateId();
        feedback.timestamp = Date.now();
        
        this.feedbackData.push(feedback);
        
        // Limitiere Speichergröße
        if (this.feedbackData.length > this.MAX_FEEDBACK_ITEMS) {
            this.feedbackData = this.feedbackData.slice(-this.MAX_FEEDBACK_ITEMS);
        }
        
        await this.saveFeedbackData();
        
        console.log(`Feedback recorded: ${feedback.rating} (Total: ${this.feedbackData.length})`);
    }
    
    /**
     * Holt ähnliche Feedback-Einträge für einen Kontext
     */
    findSimilarFeedback(
        context: CodeContext,
        minSimilarity: number = 0.5,
        limit: number = 10
    ): CommentFeedback[] {
        if (this.feedbackData.length === 0) {
            return [];
        }
        
        const similarities = this.feedbackData
            .filter(f => f.codeContext?.languageId === context.languageId)
            .map(feedback => ({
                feedback,
                score: this.calculateContextSimilarity(context, feedback.codeContext)
            }))
            .filter(item => item.score >= minSimilarity)
            .sort((a, b) => b.score - a.score);
        
        return similarities.slice(0, limit).map(item => item.feedback);
    }
    
    /**
     * Holt positives Feedback (rating = 'good')
     */
    getPositiveFeedback(context?: CodeContext): CommentFeedback[] {
        let feedback = this.feedbackData.filter(f => f.rating === 'good');
        
        if (context) {
            feedback = feedback.filter(
                f => f.codeContext?.languageId === context.languageId
            );
        }
        
        return feedback;
    }
    
    /**
     * Holt negatives Feedback (rating = 'bad')
     */
    getNegativeFeedback(context?: CodeContext): CommentFeedback[] {
        let feedback = this.feedbackData.filter(f => f.rating === 'bad');
        
        if (context) {
            feedback = feedback.filter(
                f => f.codeContext?.languageId === context.languageId
            );
        }
        
        return feedback;
    }
    
    /**
     * Berechnet Feedback-Statistiken
     */
    getStatistics(): FeedbackStatistics {
        const total = this.feedbackData.length;
        const good = this.feedbackData.filter(f => f.rating === 'good').length;
        const bad = this.feedbackData.filter(f => f.rating === 'bad').length;
        const edited = this.feedbackData.filter(f => f.wasEdited).length;
        
        const successRate = total > 0 ? Math.round((good / total) * 100) : 0;
        
        // Statistiken pro Sprache
        const byLanguage: { [key: string]: LanguageStats } = {};
        this.feedbackData.forEach(f => {
            const lang = f.codeContext?.languageId || 'unknown';
            if (!byLanguage[lang]) {
                byLanguage[lang] = { total: 0, good: 0, bad: 0 };
            }
            byLanguage[lang].total++;
            if (f.rating === 'good') byLanguage[lang].good++;
            if (f.rating === 'bad') byLanguage[lang].bad++;
        });
        
        // Statistiken pro Pattern-Type
        const byPattern: { [key: string]: PatternStats } = {};
        this.feedbackData.forEach(f => {
            const pattern = f.codeContext?.pattern?.type || 'unknown';
            if (!byPattern[pattern]) {
                byPattern[pattern] = { total: 0, good: 0, bad: 0 };
            }
            byPattern[pattern].total++;
            if (f.rating === 'good') byPattern[pattern].good++;
            if (f.rating === 'bad') byPattern[pattern].bad++;
        });
        
        // Zeitbasierte Trends (letzte 7 Tage)
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        const recentFeedback = this.feedbackData.filter(f => f.timestamp > sevenDaysAgo);
        
        const recentGood = recentFeedback.filter(f => f.rating === 'good').length;
        const recentTotal = recentFeedback.length;
        const recentSuccessRate = recentTotal > 0 
            ? Math.round((recentGood / recentTotal) * 100) 
            : 0;
        
        return {
            total,
            good,
            bad,
            edited,
            successRate,
            byLanguage,
            byPattern,
            recentSuccessRate,
            recentTotal
        };
    }
    
    /**
     * Löscht altes Feedback (älter als X Tage)
     */
    async cleanOldFeedback(daysOld: number = 90): Promise<number> {
        const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        const originalLength = this.feedbackData.length;
        
        this.feedbackData = this.feedbackData.filter(
            f => f.timestamp > cutoffDate
        );
        
        const removed = originalLength - this.feedbackData.length;
        
        if (removed > 0) {
            await this.saveFeedbackData();
            console.log(`Cleaned ${removed} old feedback entries`);
        }
        
        return removed;
    }
    
    /**
     * Exportiert Feedback als JSON (für Analyse)
     */
    async exportFeedback(filePath: string): Promise<void> {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalEntries: this.feedbackData.length,
            statistics: this.getStatistics(),
            feedback: this.feedbackData
        };
        
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
        
        vscode.window.showInformationMessage(
            `Feedback exported: ${this.feedbackData.length} entries`
        );
    }
    
    // ===== PRIVATE METHODS =====
    
    /**
     * Berechnet Kontext-Ähnlichkeit
     */
    private calculateContextSimilarity(
        context1: CodeContext,
        context2: CodeContext | undefined
    ): number {
        if (!context2) return 0;
        if (context1.languageId !== context2.languageId) return 0;
        
        let score = 0;
        
        // Pattern-Type Übereinstimmung (40%)
        if (context1.pattern?.type === context2.pattern?.type) {
            score += 0.4;
        }
        
        // Komplexität ähnlich (20%)
        const complexityDiff = Math.abs(context1.complexity - context2.complexity);
        const complexityScore = Math.max(0, 1 - (complexityDiff / 10));
        score += complexityScore * 0.2;
        
        // Keywords Überschneidung (40%)
        const keywords1 = context1.codeElement?.keywords || [];
        const keywords2 = context2.codeElement?.keywords || [];
        if (keywords1.length > 0 && keywords2.length > 0) {
            const intersection = keywords1.filter(k => 
                keywords2.some(k2 => k2.toLowerCase() === k.toLowerCase())
            );
            const keywordScore = intersection.length / Math.max(keywords1.length, keywords2.length);
            score += keywordScore * 0.4;
        }
        
        return Math.min(1, score);
    }
    
    /**
     * Lädt Feedback-Daten von Disk
     */
    private loadFeedbackData(): void {
        try {
            if (fs.existsSync(this.storageFile)) {
                const data = fs.readFileSync(this.storageFile, 'utf8');
                const parsed = JSON.parse(data);
                this.feedbackData = parsed.feedback || [];
                console.log(`Loaded ${this.feedbackData.length} feedback entries`);
            }
        } catch (error) {
            console.error('Failed to load feedback data:', error);
            this.feedbackData = [];
        }
    }
    
    /**
     * Speichert Feedback-Daten auf Disk
     */
    private async saveFeedbackData(): Promise<void> {
        try {
            const data = {
                version: '1.0',
                lastUpdated: Date.now(),
                feedback: this.feedbackData
            };
            
            fs.writeFileSync(
                this.storageFile,
                JSON.stringify(data, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('Failed to save feedback data:', error);
        }
    }
    
    /**
     * Stellt sicher, dass Storage-Verzeichnis existiert
     */
    private ensureStorageDirectory(): void {
        const dir = path.dirname(this.storageFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    /**
     * Generiert eindeutige ID
     */
    private generateId(): string {
        return `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ===== INTERFACES =====

export interface CommentFeedback {
    id?: string;
    timestamp: number;
    
    // Der ursprüngliche Input
    originalTranscript: string;
    
    // Der generierte Kommentar
    generatedComment: string;
    
    // User-Rating
    rating: 'good' | 'bad' | 'neutral';
    
    // Wurde der Kommentar editiert?
    wasEdited: boolean;
    editedComment?: string;
    
    // Code-Kontext
    codeContext: CodeContext;
    
    // Optional: Warum war es gut/schlecht?
    reason?: string;
    
    // Quelle (voice, auto, manual)
    source: 'voice' | 'auto' | 'manual';
}

export interface FeedbackStatistics {
    total: number;
    good: number;
    bad: number;
    edited: number;
    successRate: number;
    byLanguage: { [key: string]: LanguageStats };
    byPattern: { [key: string]: PatternStats };
    recentSuccessRate: number;
    recentTotal: number;
}

interface LanguageStats {
    total: number;
    good: number;
    bad: number;
}

interface PatternStats {
    total: number;
    good: number;
    bad: number;
}
