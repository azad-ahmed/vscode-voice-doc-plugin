/**
 * Learning System - Hauptexport
 * 
 * Dieses Modul exportiert alle Komponenten des adaptiven Learning-Systems:
 * - CodeContextAnalyzer: Analysiert Code-Kontext für Pattern Recognition
 * - FeedbackManager: Verwaltet User-Feedback
 * - AdaptiveLearningEngine: Lernt aus Feedback und verbessert Kommentare
 * - LearningSystem: Ursprüngliches System (Legacy, für Kompatibilität)
 */

export { CodeContextAnalyzer, CodeContext, CodePattern, CodeElementInfo } from './codeContextAnalyzer';
export { FeedbackManager, CommentFeedback, FeedbackStatistics } from './feedbackManager';
export { AdaptiveLearningEngine, ImprovedComment, CommentTemplate, LearningStatistics } from './adaptiveLearningEngine';
export { LearningSystem, TrainingExample, Statistics } from './learningSystem';

/**
 * Factory-Funktion: Erstellt eine vollständige Learning-Instanz
 */
import * as vscode from 'vscode';
import { FeedbackManager } from './feedbackManager';
import { AdaptiveLearningEngine } from './adaptiveLearningEngine';
import { LearningSystem } from './learningSystem';

export class VoiceDocLearning {
    public feedbackManager: FeedbackManager;
    public adaptiveEngine: AdaptiveLearningEngine;
    public legacySystem: LearningSystem;
    
    constructor(context: vscode.ExtensionContext) {
        // Initialisiere alle Komponenten
        this.feedbackManager = new FeedbackManager(context);
        this.adaptiveEngine = new AdaptiveLearningEngine(context, this.feedbackManager);
        this.legacySystem = new LearningSystem(context);
        
        console.log('✨ VoiceDoc Learning System initialized');
    }
    
    /**
     * Hauptmethode: Verbessert einen Kommentar mit allen verfügbaren Techniken
     */
    async improveCommentWithLearning(
        transcript: string,
        editor: vscode.TextEditor
    ): Promise<string> {
        // 1. Analysiere Code-Kontext
        const context = this.adaptiveEngine['contextAnalyzer'].analyzeCurrentContext(
            editor,
            editor.selection.active
        );
        
        // 2. Nutze Adaptive Engine
        const improved = await this.adaptiveEngine.improveComment(
            transcript,
            context,
            true
        );
        
        console.log(`📊 Improvement confidence: ${improved.confidence}, method: ${improved.method}`);
        
        return improved.improvedText;
    }
    
    /**
     * Registriert Feedback für einen Kommentar
     */
    async recordUserFeedback(
        transcript: string,
        generatedComment: string,
        rating: 'good' | 'bad' | 'neutral',
        editor: vscode.TextEditor,
        wasEdited: boolean = false,
        editedComment?: string
    ): Promise<void> {
        const context = this.adaptiveEngine['contextAnalyzer'].analyzeCurrentContext(
            editor,
            editor.selection.active
        );
        
        await this.feedbackManager.recordFeedback({
            timestamp: Date.now(),
            originalTranscript: transcript,
            generatedComment,
            rating,
            wasEdited,
            editedComment,
            codeContext: context,
            source: 'voice'
        });
        
        console.log(`✅ Feedback recorded: ${rating}`);
    }
    
    /**
     * Holt kombinierte Statistiken
     */
    getStatistics() {
        return {
            learning: this.adaptiveEngine.getStatistics(),
            feedback: this.feedbackManager.getStatistics(),
            legacy: this.legacySystem.getStatistics()
        };
    }
}
