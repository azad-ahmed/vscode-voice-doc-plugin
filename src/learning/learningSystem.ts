import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LearningSystem {
    private trainingData: TrainingExample[] = [];
    private patterns: Map<string, Pattern[]> = new Map();
    private glossary: Map<string, GlossaryEntry> = new Map();
    private storageFile: string;

    constructor(private context: vscode.ExtensionContext) {
        this.storageFile = path.join(this.context.globalStorageUri.fsPath, 'learning-data.json');
        this.ensureStorageDirectory();
        this.loadTrainingData();
    }

    addTrainingExample(example: TrainingExample): void {
        example.id = this.generateId();
        example.timestamp = example.timestamp || Date.now();
        this.trainingData.push(example);

        this.extractPatterns(example);
        this.updateGlossary(example);

        if (this.trainingData.length % 5 === 0) {
            this.saveTrainingData();
        }

        console.log(`Training example added. Total: ${this.trainingData.length}`);
    }

    findSimilarExamples(codeContext: any, limit = 5): TrainingExample[] {
        if (this.trainingData.length === 0) {
            return [];
        }

        const similarities = this.trainingData.map(example => ({
            example: example,
            score: this.calculateSimilarity(codeContext, example.codeContext)
        }));

        similarities.sort((a, b) => b.score - a.score);

        return similarities
            .slice(0, limit)
            .filter(item => item.score > 0.3)
            .map(item => item.example);
    }

    private calculateSimilarity(context1: any, context2: any): number {
        if (!context1 || !context2) return 0;

        let score = 0;

        if (context1.languageId === context2.languageId) {
            score += 0.3;
        } else {
            return 0;
        }

        if (context1.functionType === context2.functionType) {
            score += 0.2;
        }

        const nameScore = this.stringSimilarity(context1.functionName, context2.functionName);
        score += nameScore * 0.2;

        const codeScore = this.codeSimilarity(context1.code, context2.code);
        score += codeScore * 0.3;

        return Math.min(1, score);
    }

    private stringSimilarity(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;
        
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();

        if (str1 === str2) return 1;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1;

        const editDistance = this.editDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    private editDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    private codeSimilarity(code1: string, code2: string): number {
        if (!code1 || !code2) return 0;

        const tokens1 = this.tokenize(code1);
        const tokens2 = this.tokenize(code2);

        const intersection = tokens1.filter(token => tokens2.includes(token));
        const union = [...new Set([...tokens1, ...tokens2])];

        return union.length > 0 ? intersection.length / union.length : 0;
    }

    private tokenize(code: string): string[] {
        code = code.replace(/\/\/.*$/gm, '');
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');
        code = code.replace(/"[^"]*"/g, '');
        code = code.replace(/'[^']*'/g, '');

        return code
            .toLowerCase()
            .match(/\b\w+\b/g) || [];
    }

    private extractPatterns(example: TrainingExample): void {
        const { codeContext, output } = example;

        if (!codeContext || !output) return;

        const patternKey = `${codeContext.languageId}:${codeContext.functionType}`;
        
        if (!this.patterns.has(patternKey)) {
            this.patterns.set(patternKey, []);
        }

        this.patterns.get(patternKey)!.push({
            template: this.extractTemplate(output),
            example: example,
            usageCount: 1
        });

        const patterns = this.patterns.get(patternKey)!;
        if (patterns.length > 50) {
            patterns.shift();
        }
    }

    private extractTemplate(documentation: string): string {
        let template = documentation;
        
        template = template.replace(/"[^"]+"/g, '"{NAME}"');
        template = template.replace(/'[^']+'/g, "'{NAME}'");
        template = template.replace(/\b\d+\b/g, '{NUMBER}');

        return template;
    }

    private updateGlossary(example: TrainingExample): void {
        const { input, output } = example;

        if (!input || !output) return;

        const terms = this.extractTerms(input + ' ' + output);

        terms.forEach(term => {
            if (!this.glossary.has(term)) {
                this.glossary.set(term, {
                    term: term,
                    frequency: 0,
                    contexts: []
                });
            }

            const entry = this.glossary.get(term)!;
            entry.frequency++;
        });
    }

    private extractTerms(text: string): string[] {
        const stopWords = new Set([
            'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'ist', 'wird', 'werden',
            'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'be'
        ]);

        return (text
            .toLowerCase()
            .match(/\b\w{4,}\b/g) || [])
            .filter(word => !stopWords.has(word))
            .filter((word, index, arr) => arr.indexOf(word) === index);
    }

    getBestPractices(codeContext: any): Pattern[] | null {
        const patternKey = `${codeContext.languageId}:${codeContext.functionType}`;
        
        if (!this.patterns.has(patternKey)) {
            return null;
        }

        const patterns = this.patterns.get(patternKey)!;
        patterns.sort((a, b) => b.usageCount - a.usageCount);

        return patterns.slice(0, 3);
    }

    getStatistics(): Statistics {
        const totalExamples = this.trainingData.length;
        const voiceExamples = this.trainingData.filter(e => e.source === 'voice').length;
        const autoExamples = this.trainingData.filter(e => e.source === 'auto').length;
        
        const acceptedExamples = this.trainingData.filter(e => e.accepted === true).length;
        const acceptanceRate = totalExamples > 0 ? Math.round((acceptedExamples / totalExamples) * 100) : 0;

        const confidenceSum = this.trainingData
            .filter(e => e.confidence !== undefined)
            .reduce((sum, e) => sum + (e.confidence || 0), 0);
        const avgConfidence = this.trainingData.filter(e => e.confidence).length > 0
            ? Math.round((confidenceSum / this.trainingData.filter(e => e.confidence).length) * 100)
            : 0;

        const languageStats: { [key: string]: number } = {};
        this.trainingData.forEach(e => {
            const lang = e.codeContext?.languageId || 'unknown';
            languageStats[lang] = (languageStats[lang] || 0) + 1;
        });

        const recentExamples = this.trainingData
            .slice(-10)
            .reverse()
            .map(e => ({
                source: e.source,
                languageId: e.codeContext?.languageId,
                input: e.input,
                timestamp: e.timestamp
            }));

        return {
            totalExamples,
            voiceExamples,
            autoExamples,
            acceptanceRate,
            avgConfidence,
            languageStats,
            recentExamples,
            patternsCount: this.patterns.size,
            glossarySize: this.glossary.size
        };
    }

    private loadTrainingData(): void {
        try {
            if (fs.existsSync(this.storageFile)) {
                const data = fs.readFileSync(this.storageFile, 'utf8');
                const parsed = JSON.parse(data);
                
                this.trainingData = parsed.trainingData || [];
                
                if (parsed.patterns) {
                    this.patterns = new Map(Object.entries(parsed.patterns));
                }
                if (parsed.glossary) {
                    this.glossary = new Map(Object.entries(parsed.glossary));
                }

                console.log(`Loaded ${this.trainingData.length} training examples`);
            }
        } catch (error) {
            console.error('Failed to load training data:', error);
        }
    }

    private saveTrainingData(): void {
        try {
            const data = {
                version: '1.0',
                timestamp: Date.now(),
                trainingData: this.trainingData,
                patterns: Object.fromEntries(this.patterns),
                glossary: Object.fromEntries(this.glossary)
            };

            fs.writeFileSync(
                this.storageFile,
                JSON.stringify(data, null, 2),
                'utf8'
            );

            console.log(`Saved ${this.trainingData.length} training examples`);
        } catch (error) {
            console.error('Failed to save training data:', error);
        }
    }

    private ensureStorageDirectory(): void {
        const dir = path.dirname(this.storageFile);
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (error) {
                console.error('Failed to create storage directory:', error);
            }
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Interfaces
export interface TrainingExample {
    id?: string;
    input: string;
    output: string;
    codeContext?: any;
    source: 'voice' | 'auto' | 'feedback';
    accepted?: boolean;
    edited?: boolean;
    originalSuggestion?: string;
    confidence?: number;
    timestamp?: number;
}

interface Pattern {
    template: string;
    example: TrainingExample;
    usageCount: number;
}

interface GlossaryEntry {
    term: string;
    frequency: number;
    contexts: any[];
}

export interface Statistics {
    totalExamples: number;
    voiceExamples: number;
    autoExamples: number;
    acceptanceRate: number;
    avgConfidence: number;
    languageStats: { [key: string]: number };
    recentExamples: any[];
    patternsCount: number;
    glossarySize: number;
}
