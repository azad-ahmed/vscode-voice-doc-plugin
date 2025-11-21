import * as vscode from 'vscode';
import { OfflineCodeAnalyzer, CodeStructureInfo } from './offlineAnalyzer';
import { ErrorHandler } from '../utils/errorHandler';


export class SmartOfflinePlacer {


    static async placeCommentIntelligently(
        editor: vscode.TextEditor,
        commentText: string,
        position: vscode.Position
    ): Promise<PlacementResult> {
        try {
            ErrorHandler.log('SmartOfflinePlacer', '🧠 Starte intelligente Platzierung (offline)...');

            const document = editor.document;

            const structure = await OfflineCodeAnalyzer.analyzeCodeStructure(document, position);
            
            ErrorHandler.log('SmartOfflinePlacer', 
                `📊 Struktur erkannt: ${structure.type} "${structure.name}" (Konfidenz: ${Math.round(structure.confidence * 100)}%)`
            );


            const formattedComment = this.formatCommentForLanguage(
                commentText,
                document.languageId,
                structure
            );


            const insertPosition = this.calculateInsertPosition(
                document,
                structure
            );


            const validation = this.validatePlacement(
                document,
                insertPosition,
                structure
            );

            if (!validation.isValid) {
                ErrorHandler.log('SmartOfflinePlacer', `⚠️ Validierung fehlgeschlagen: ${validation.reason}`);
                

                return {
                    success: false,
                    reason: validation.reason,
                    fallbackPosition: position
                };
            }


            const success = await editor.edit(editBuilder => {
                const commentWithIndent = this.addIndentation(
                    formattedComment,
                    structure.indentation
                );
                
                editBuilder.insert(insertPosition, commentWithIndent + '\n');
            });

            if (success) {
                ErrorHandler.log('SmartOfflinePlacer', '✅ Kommentar erfolgreich platziert!', 'success');
                

                vscode.window.showInformationMessage(
                    `✅ Kommentar für ${structure.type} "${structure.name}" eingefügt!`
                );

                return {
                    success: true,
                    structure: structure,
                    insertedAt: insertPosition
                };
            } else {
                return {
                    success: false,
                    reason: 'Editor.edit fehlgeschlagen'
                };
            }

        } catch (error: any) {
            ErrorHandler.handleError('SmartOfflinePlacer.placeCommentIntelligently', error);
            
            return {
                success: false,
                reason: error.message
            };
        }
    }


    private static formatCommentForLanguage(
        text: string,
        languageId: string,
        structure: CodeStructureInfo
    ): string {

        text = text.trim();
        

        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }


        if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
            text += '.';
        }


        switch (languageId) {
            case 'typescript':
            case 'javascript':
                return this.formatJSDoc(text, structure);
            
            case 'python':
                return this.formatPythonDocstring(text, structure);
            
            case 'java':
            case 'csharp':
                return this.formatJavaDoc(text, structure);
            
            case 'php':
                return this.formatPHPDoc(text, structure);
            
            case 'go':
                return this.formatGoComment(text, structure);
            
            case 'rust':
                return this.formatRustComment(text, structure);
            
            default:
                return `// ${text}`;
        }
    }


    private static formatJSDoc(text: string, structure: CodeStructureInfo): string {
        const lines = ['/**', ` * ${text}`];
        
        if (structure.type === 'function' || structure.type === 'method') {
            lines.push(` * @returns Beschreibung des Rückgabewerts`);
        }
        
        lines.push(' */');
        return lines.join('\n');
    }


    private static formatPythonDocstring(text: string, structure: CodeStructureInfo): string {
        if (structure.type === 'function' || structure.type === 'method') {
            return `    """\n    ${text}\n    \n    Args:\n        Parameter: Beschreibung\n    \n    Returns:\n        Rückgabewert\n    """`;
        }
        
        return `"""\n${text}\n"""`;
    }


    private static formatJavaDoc(text: string, structure: CodeStructureInfo): string {
        const lines = ['/**', ` * ${text}`];
        
        if (structure.type === 'method' || structure.type === 'function') {
            lines.push(` * @return Beschreibung`);
        }
        
        lines.push(' */');
        return lines.join('\n');
    }

 
    private static formatPHPDoc(text: string, structure: CodeStructureInfo): string {
        const lines = ['/**', ` * ${text}`];
        
        if (structure.type === 'method' || structure.type === 'function') {
            lines.push(` * @return mixed`);
        }
        
        lines.push(' */');
        return lines.join('\n');
    }


    private static formatGoComment(text: string, structure: CodeStructureInfo): string {

        if (structure.type === 'function' && structure.name) {
            return `// ${structure.name} ${text.toLowerCase()}`;
        }
        return `// ${text}`;
    }

    private static formatRustComment(text: string, structure: CodeStructureInfo): string {
        return `/// ${text}`;
    }


    private static calculateInsertPosition(
        document: vscode.TextDocument,
        structure: CodeStructureInfo
    ): vscode.Position {
        let targetLine = structure.insertLine;

        if (document.languageId === 'python' && 
            (structure.type === 'function' || structure.type === 'method')) {
            targetLine = structure.startLine + 1;
            return new vscode.Position(targetLine, 0);
        }


        

        if (targetLine > 0) {
            const previousLine = document.lineAt(targetLine - 1);
            const prevText = previousLine.text.trim();
            
            if (prevText.startsWith('/**') || prevText.startsWith('//') || prevText.startsWith('#')) {
                ErrorHandler.log('SmartOfflinePlacer', '⚠️ Kommentar bereits vorhanden, füge davor ein');
                targetLine = targetLine - 1;
            }
        }

        return new vscode.Position(targetLine, 0);
    }


    private static validatePlacement(
        document: vscode.TextDocument,
        position: vscode.Position,
        structure: CodeStructureInfo
    ): ValidationResult {

        if (position.line < 0 || position.line >= document.lineCount) {
            return {
                isValid: false,
                reason: 'Position außerhalb des Dokuments'
            };
        }


        const blockStructure = OfflineCodeAnalyzer.analyzeBlockStructure(
            document,
            Math.max(0, position.line - 20),
            Math.min(document.lineCount - 1, position.line + 5)
        );


        if (blockStructure.depth > 2) {
            ErrorHandler.log('SmartOfflinePlacer', 
                `⚠️ Tief verschachtelt (Tiefe: ${blockStructure.depth})`
            );
        }


        const line = document.lineAt(position.line);
        if (line.text.trim().length === 0) {
            return {
                isValid: true,
                reason: 'Leere Zeile - ideal'
            };
        }


        if (structure.confidence < 0.5) {
            return {
                isValid: true,
                reason: 'Niedrige Konfidenz, aber akzeptabel',
                warnings: ['Struktur-Erkennung unsicher']
            };
        }

        return {
            isValid: true,
            reason: 'Platzierung valide'
        };
    }


    private static addIndentation(text: string, indentation: number): string {
        const indent = ' '.repeat(indentation);
        const lines = text.split('\n');
        
        return lines.map((line, index) => {

            if (index === 0) {
                return indent + line;
            }

            if (line.trim().startsWith('*') || line.trim().startsWith('//')) {
                return indent + ' ' + line.trim();
            }
            return indent + line;
        }).join('\n');
    }


    static async analyzeContext(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ContextAnalysis> {
        const structure = await OfflineCodeAnalyzer.analyzeCodeStructure(document, position);
        

        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);
        
        const contextLines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            contextLines.push(document.lineAt(i).text);
        }

        return {
            structure: structure,
            surroundingCode: contextLines.join('\n'),
            languageId: document.languageId,
            hasExistingComments: this.checkForExistingComments(document, structure.startLine)
        };
    }


    private static checkForExistingComments(
        document: vscode.TextDocument,
        targetLine: number
    ): boolean {

        for (let i = Math.max(0, targetLine - 3); i < targetLine; i++) {
            const line = document.lineAt(i).text.trim();
            if (line.startsWith('//') || line.startsWith('/*') || 
                line.startsWith('*') || line.startsWith('#') ||
                line.startsWith('"""')) {
                return true;
            }
        }
        return false;
    }
}


export interface PlacementResult {
    success: boolean;
    structure?: CodeStructureInfo;
    insertedAt?: vscode.Position;
    reason?: string;
    fallbackPosition?: vscode.Position;
}


interface ValidationResult {
    isValid: boolean;
    reason: string;
    warnings?: string[];
}


export interface ContextAnalysis {
    structure: CodeStructureInfo;
    surroundingCode: string;
    languageId: string;
    hasExistingComments: boolean;
}
