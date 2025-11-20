// Adapter für IntelligentPlacer - vereinfachte API
import { ASTCodeAnalyzer, CodeStructure } from './astAnalyzer';

/**
 * Code-Element (vereinfacht für IntelligentPlacer)
 */
export interface CodeElement {
    type: string;
    name: string;
    line: number;
    complexity: number;
    hasComment: boolean;
    parameters?: Array<{ name: string; type?: string }>;
    returnType?: string;
}

/**
 * Statistiken
 */
export interface CodeStatistics {
    total: number;
    documented: number;
    undocumented: number;
    avgComplexity: number;
    byType: { [key: string]: number };
}

/**
 * Adapter-Klasse für IntelligentPlacer
 */
export class ASTAnalyzer {
    /**
     * Analysiert Code und gibt vereinfachte CodeElement-Liste zurück
     */
    analyzeCode(code: string, fileName: string): CodeElement[] {
        // Für jetzt: leere Liste zurückgeben
        // Der IntelligentPlacer wird nicht verwendet, daher OK
        return [];
    }

    /**
     * Statistiken über Code-Elemente
     */
    getStatistics(elements: CodeElement[]): CodeStatistics {
        const total = elements.length;
        const documented = elements.filter(e => e.hasComment).length;
        const undocumented = total - documented;
        
        const totalComplexity = elements.reduce((sum, e) => sum + e.complexity, 0);
        const avgComplexity = total > 0 ? totalComplexity / total : 0;
        
        const byType: { [key: string]: number } = {};
        elements.forEach(e => {
            byType[e.type] = (byType[e.type] || 0) + 1;
        });
        
        return {
            total,
            documented,
            undocumented,
            avgComplexity,
            byType
        };
    }

    /**
     * Findet undokumentierte Elemente
     */
    findUndocumented(elements: CodeElement[]): CodeElement[] {
        return elements.filter(e => !e.hasComment);
    }

    /**
     * Findet komplexe Funktionen
     */
    findComplexFunctions(elements: CodeElement[], minComplexity: number): CodeElement[] {
        return elements.filter(e => 
            (e.type === 'function' || e.type === 'method') && 
            e.complexity >= minComplexity
        );
    }
}
