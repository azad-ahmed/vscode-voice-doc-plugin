import * as vscode from 'vscode';
import { VoiceDocLearning } from './index';

/**
 * Feedback UI - Erlaubt Usern, generierte Kommentare zu bewerten
 */
export class FeedbackUI {
    constructor(private learning: VoiceDocLearning) {}
    
    /**
     * Zeigt Feedback-Dialog für einen generierten Kommentar
     */
    async showFeedbackDialog(
        transcript: string,
        generatedComment: string,
        editor: vscode.TextEditor
    ): Promise<void> {
        const options: vscode.QuickPickItem[] = [
            {
                label: '👍 Good',
                description: 'Kommentar ist hilfreich und korrekt',
                detail: 'System lernt, dass dieser Kommentar-Stil gut ist'
            },
            {
                label: '👎 Bad',
                description: 'Kommentar ist nicht hilfreich oder falsch',
                detail: 'System lernt, dass dieser Stil vermieden werden sollte'
            },
            {
                label: '✏️ Edit & Rate',
                description: 'Kommentar bearbeiten und dann bewerten',
                detail: 'System lernt aus deiner verbesserten Version'
            },
            {
                label: '⏭️ Skip',
                description: 'Kein Feedback geben',
                detail: 'Kommentar wird gespeichert, aber nicht zum Lernen verwendet'
            }
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Wie war der generierte Kommentar?',
            title: 'VoiceDoc Feedback'
        });
        
        if (!selected) {
            return; // User hat abgebrochen
        }
        
        switch (selected.label) {
            case '👍 Good':
                await this.learning.recordUserFeedback(
                    transcript,
                    generatedComment,
                    'good',
                    editor,
                    false
                );
                vscode.window.showInformationMessage('✅ Danke! System hat gelernt.');
                break;
                
            case '👎 Bad':
                await this.learning.recordUserFeedback(
                    transcript,
                    generatedComment,
                    'bad',
                    editor,
                    false
                );
                vscode.window.showInformationMessage('✅ Danke! System wird diesen Stil vermeiden.');
                break;
                
            case '✏️ Edit & Rate':
                await this.handleEditAndRate(transcript, generatedComment, editor);
                break;
                
            case '⏭️ Skip':
                // Nichts tun
                break;
        }
    }
    
    /**
     * Erlaubt User, Kommentar zu editieren und dann zu bewerten
     */
    private async handleEditAndRate(
        transcript: string,
        generatedComment: string,
        editor: vscode.TextEditor
    ): Promise<void> {
        const editedComment = await vscode.window.showInputBox({
            prompt: 'Bearbeite den Kommentar',
            value: generatedComment,
            placeHolder: 'Verbesserte Version...'
        });
        
        if (!editedComment) {
            return; // User hat abgebrochen
        }
        
        // Frage ob Original gut oder schlecht war
        const ratingOptions: vscode.QuickPickItem[] = [
            {
                label: '👍 Original war gut, nur kleine Änderung',
                description: 'Rating: Good'
            },
            {
                label: '👎 Original war schlecht, große Änderung nötig',
                description: 'Rating: Bad'
            }
        ];
        
        const rating = await vscode.window.showQuickPick(ratingOptions, {
            placeHolder: 'Wie war der ursprüngliche Kommentar?'
        });
        
        if (!rating) {
            return;
        }
        
        const isGood = rating.label.startsWith('👍');
        
        await this.learning.recordUserFeedback(
            transcript,
            generatedComment,
            isGood ? 'good' : 'bad',
            editor,
            true,
            editedComment
        );
        
        // Ersetze Kommentar im Editor mit editierter Version
        const position = editor.selection.active;
        const lineText = editor.document.lineAt(position.line).text;
        const commentStart = lineText.indexOf(generatedComment);
        
        if (commentStart >= 0) {
            const range = new vscode.Range(
                position.line,
                commentStart,
                position.line,
                commentStart + generatedComment.length
            );
            
            await editor.edit(editBuilder => {
                editBuilder.replace(range, editedComment);
            });
        }
        
        vscode.window.showInformationMessage('✅ Danke! Kommentar aktualisiert und System hat gelernt.');
    }
    
    /**
     * Zeigt Learning-Statistiken
     */
    async showStatistics(): Promise<void> {
        const stats = this.learning.getStatistics();
        
        const message = `
📊 VoiceDoc Learning Statistics

🎯 Feedback:
  • Total: ${stats.feedback.total}
  • Good: ${stats.feedback.good} (${stats.feedback.successRate}%)
  • Bad: ${stats.feedback.bad}
  • Edited: ${stats.feedback.edited}

🧠 Learning:
  • Templates: ${stats.learning.totalTemplates}
  • Template Usage: ${stats.learning.totalTemplateUsage}
  • Recent Success Rate: ${stats.learning.recentSuccessRate}%

📈 Trend: ${this.getTrendEmoji(stats.learning.recentSuccessRate)}
        `.trim();
        
        const action = await vscode.window.showInformationMessage(
            message,
            'Export Data',
            'Clean Old Data',
            'Close'
        );
        
        if (action === 'Export Data') {
            await this.exportStatistics();
        } else if (action === 'Clean Old Data') {
            await this.cleanOldData();
        }
    }
    
    /**
     * Exportiert Feedback-Daten
     */
    private async exportStatistics(): Promise<void> {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('voicedoc-feedback.json'),
            filters: {
                'JSON': ['json']
            }
        });
        
        if (uri) {
            await this.learning.feedbackManager.exportFeedback(uri.fsPath);
        }
    }
    
    /**
     * Löscht alte Feedback-Daten
     */
    private async cleanOldData(): Promise<void> {
        const options: vscode.QuickPickItem[] = [
            { label: '30 Tage', description: 'Lösche Daten älter als 30 Tage' },
            { label: '60 Tage', description: 'Lösche Daten älter als 60 Tage' },
            { label: '90 Tage', description: 'Lösche Daten älter als 90 Tage' }
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Wie alt sollen die zu löschenden Daten sein?'
        });
        
        if (!selected) {
            return;
        }
        
        const days = parseInt(selected.label);
        const removed = await this.learning.feedbackManager.cleanOldFeedback(days);
        
        vscode.window.showInformationMessage(
            `🗑️ ${removed} alte Einträge gelöscht`
        );
    }
    
    /**
     * Holt Trend-Emoji basierend auf Success Rate
     */
    private getTrendEmoji(successRate: number): string {
        if (successRate >= 80) return '🚀 Excellent';
        if (successRate >= 65) return '📈 Good';
        if (successRate >= 50) return '➡️ OK';
        return '📉 Needs Improvement';
    }
}
