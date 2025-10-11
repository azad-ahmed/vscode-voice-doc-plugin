/**
 * Definiert die Struktur eines Code-Elements für die Analyse
 */
export interface CodeElement {
    type: 'function' | 'method' | 'class' | 'interface' | 'variable' | 'arrow-function';
    name: string;
    startLine: number;
    endLine: number;
    complexity?: number;
    body?: string;
    isAsync?: boolean;
    isStatic?: boolean;
    isPrivate?: boolean;
    isAbstract?: boolean;
    isExported?: boolean;
    parameters?: Array<{ name: string; type: string }>;
    returnType?: string;
    methods?: CodeElement[];
}

/**
 * Ergebnis einer Code-Analyse
 */
export interface AnalysisResult {
    elements: CodeElement[];
    metrics: {
        totalLines: number;
        commentedLines: number;
        complexity: number;
    };
}
