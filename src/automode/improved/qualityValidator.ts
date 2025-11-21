/**
 * Validates quality of generated comments
 * 
 * Checks:
 * - Length and information content
 * - No meta-descriptions
 * - No redundancy with code
 * - Meaningful content
 * - Language quality
 */
export class CommentQualityValidator {
    
    /**
     * Validates a generated comment
     */
    static validate(
        comment: string,
        code: string,
        functionName: string,
        languageId: string
    ): ValidationResult {
        const issues: ValidationIssue[] = [];
        let score = 100;
        
        const lengthIssues = this.checkLength(comment);
        issues.push(...lengthIssues);
        score -= lengthIssues.length * 10;
        
        const metaIssues = this.checkMetaDescriptions(comment);
        issues.push(...metaIssues);
        score -= metaIssues.length * 15;
        
        const redundancyScore = this.checkRedundancy(comment, code, functionName);
        if (redundancyScore > 0.5) {
            issues.push({
                type: 'redundancy',
                severity: 'medium',
                message: 'Comment repeats code',
                suggestion: 'Explain the "why" and "what", not the "how"'
            });
            score -= 25;
        }
        
        if (!this.explainsWhy(comment)) {
            issues.push({
                type: 'missing-why',
                severity: 'low',
                message: 'Comment does not explain "why"',
                suggestion: 'Add context: Why does this function exist?'
            });
            score -= 10;
        }
        
        if (this.isGeneric(comment, functionName)) {
            issues.push({
                type: 'generic',
                severity: 'high',
                message: 'Comment is too generic',
                suggestion: 'Be more specific about the function'
            });
            score -= 20;
        }
        
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
     * Checks comment length
     */
    private static checkLength(comment: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const cleaned = this.cleanComment(comment);
        
        if (cleaned.length < 20) {
            issues.push({
                type: 'too-short',
                severity: 'high',
                message: 'Comment too short (< 20 characters)',
                suggestion: 'Add more details'
            });
        }
        
        if (cleaned.length > 300) {
            issues.push({
                type: 'too-long',
                severity: 'medium',
                message: 'Comment too long (> 300 characters)',
                suggestion: 'Keep to essential information'
            });
        }
        
        return issues;
    }
    
    /**
     * Checks for meta-descriptions
     */
    private static checkMetaDescriptions(comment: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const lower = comment.toLowerCase();
        
        const metaPhrases = [
            'this code',
            'this function',
            'this method',
            'this section',
            'here we',
            'it does',
            'this is',
            'this is a function',
            'this class',
            'this block'
        ];
        
        for (const phrase of metaPhrases) {
            if (lower.includes(phrase)) {
                issues.push({
                    type: 'meta-description',
                    severity: 'high',
                    message: `Contains meta phrase: "${phrase}"`,
                    suggestion: 'Describe directly what the code does, not that it is code'
                });
                break;
            }
        }
        
        return issues;
    }
    
    /**
     * Calculates redundancy with code (0-1)
     */
    private static checkRedundancy(comment: string, code: string, functionName: string): number {
        const normalizedComment = this.normalize(comment);
        const normalizedCode = this.normalize(code);
        const normalizedFunctionName = this.normalize(functionName);
        
        if (normalizedComment === normalizedFunctionName) {
            return 1.0;
        }
        
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
     * Checks if comment explains "why"
     */
    private static explainsWhy(comment: string): boolean {
        const lower = comment.toLowerCase();
        
        const whyIndicators = [
            'because', 'to', 'for', 'since', 'ensures', 'prevents',
            'enables', 'guarantees', 'purpose', 'goal', 'reason',
            'needed', 'required', 'necessary'
        ];
        
        return whyIndicators.some(indicator => lower.includes(indicator));
    }
    
    /**
     * Checks if comment is too generic
     */
    private static isGeneric(comment: string, functionName: string): boolean {
        const lower = comment.toLowerCase();
        
        const genericPhrases = [
            'function',
            'method',
            'does something',
            'handles',
            'processes'
        ];
        
        const words = lower.split(/\s+/);
        const genericCount = words.filter(word => 
            genericPhrases.some(phrase => phrase.includes(word))
        ).length;
        
        return genericCount > words.length * 0.5;
    }
    
    /**
     * Checks language quality
     */
    private static checkLanguageQuality(comment: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        
        if (comment.includes('  ')) {
            issues.push({
                type: 'double-spaces',
                severity: 'low',
                message: 'Contains double spaces',
                suggestion: 'Fix formatting'
            });
        }
        
        const cleaned = this.cleanComment(comment);
        if (cleaned.length > 0 && !/[.!?]$/.test(cleaned.trim())) {
            issues.push({
                type: 'missing-punctuation',
                severity: 'low',
                message: 'Sentence does not end with punctuation',
                suggestion: 'Add closing punctuation'
            });
        }
        
        return issues;
    }
    
    /**
     * Gets recommendation based on score
     */
    private static getRecommendation(score: number, issues: ValidationIssue[]): string {
        if (score >= 80) {
            return 'Good quality - comment can be used';
        }
        
        if (score >= 60) {
            return 'Acceptable quality - minor improvements possible';
        }
        
        if (score >= 40) {
            return 'Low quality - revision recommended';
        }
        
        return 'Poor quality - comment should be regenerated';
    }
    
    /**
     * Cleans comment from syntax
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
     * Normalizes text for comparison
     */
    private static normalize(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    /**
     * Improves a comment based on issues
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

export interface ValidationResult {
    isValid: boolean;
    score: number;
    issues: ValidationIssue[];
    recommendation: string;
}

export interface ValidationIssue {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion: string;
}
