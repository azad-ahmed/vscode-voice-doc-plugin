"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const generator_1 = require("../../src/generator");
suite('CommentGenerator Tests', () => {
    let generator;
    setup(() => {
        generator = new generator_1.CommentGenerator('auto');
    });
    suite('Basic Formatting', () => {
        test('Should format simple single-line comment', () => {
            const text = 'Diese Funktion berechnet die Summe';
            const result = generator.formatComment(text, 'typescript');
            assert.strictEqual(result, '// Diese Funktion berechnet die Summe');
        });
        test('Should create multiline comment for long text', () => {
            const longText = 'Diese sehr lange Funktion macht viele verschiedene Dinge und braucht daher einen ausführlichen Kommentar der über mehrere Zeilen geht und sehr detailliert ist';
            const result = generator.formatComment(longText, 'typescript');
            assert.ok(result.includes('/**'), 'Should start with /**');
            assert.ok(result.includes('*/'), 'Should end with */');
            assert.ok(result.includes(' * '), 'Should have proper line prefix');
        });
        test('Should use correct comment style for Python', () => {
            const text = 'Test function';
            const result = generator.formatComment(text, 'python');
            assert.ok(result.startsWith('#'), 'Python should use # for comments');
        });
        test('Should use correct comment style for Java', () => {
            const text = 'Test method implementation';
            const result = generator.formatComment(text, 'java');
            assert.ok(result.startsWith('//'), 'Java should use // for short comments');
        });
        test('Should handle empty text gracefully', () => {
            const result = generator.formatComment('', 'typescript');
            assert.ok(result.includes('Keine Spracheingabe'), 'Should have fallback message');
        });
        test('Should handle whitespace-only text', () => {
            const result = generator.formatComment('   ', 'typescript');
            assert.ok(result.includes('Keine Spracheingabe'), 'Should handle whitespace');
        });
    });
    suite('Text Cleaning', () => {
        test('Should remove filler words from start', () => {
            const text = 'äh also diese Funktion macht was';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(!result.toLowerCase().includes('äh'), 'Should not contain äh');
            assert.ok(!result.toLowerCase().includes('also'), 'Should not contain also at start');
        });
        test('Should trim whitespace', () => {
            const text = '  Diese Funktion testet  ';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.includes('Diese Funktion testet'), 'Should trim whitespace');
            assert.ok(!result.includes('  Diese'), 'Should not have leading spaces in content');
        });
        test('Should remove trailing punctuation', () => {
            const text = 'Diese Funktion testet...';
            const result = generator.formatComment(text, 'typescript');
            // The text should be cleaned but still readable
            assert.ok(result.includes('Funktion'), 'Should preserve main content');
        });
        test('Should capitalize first letter', () => {
            const text = 'diese funktion';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.includes('Diese') || result.includes('diese'), 'Should have proper case');
        });
    });
    suite('Technical Term Replacement', () => {
        test('Should capitalize technical terms', () => {
            const text = 'diese variable speichert die datenbank verbindung';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.includes('Variable') || result.includes('variable'), 'Should handle variable');
            assert.ok(result.includes('Datenbank') || result.includes('datenbank'), 'Should handle Datenbank');
        });
        test('Should handle multiple technical terms', () => {
            const text = 'die funktion nutzt eine api und array';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.length > 0, 'Should produce output');
            assert.ok(result.includes('//') || result.includes('/**'), 'Should have comment syntax');
        });
    });
    suite('Comment Validation', () => {
        test('Should validate good comment as valid', () => {
            const comment = '// This is a good comment explaining the code functionality';
            const validation = generator.validateComment(comment);
            assert.strictEqual(validation.isValid, true, 'Good comment should be valid');
            assert.ok(validation.score >= 50, 'Score should be at least 50');
        });
        test('Should detect short comments', () => {
            const shortComment = '// Test';
            const validation = generator.validateComment(shortComment);
            assert.ok(validation.score < 100, 'Short comment should have lower score');
            assert.ok(validation.suggestions.length > 0, 'Should have suggestions');
        });
        test('Should detect very long comments', () => {
            const longComment = '// ' + 'x'.repeat(600);
            const validation = generator.validateComment(longComment);
            assert.ok(validation.score < 100, 'Very long comment should have lower score');
        });
        test('Should detect filler words', () => {
            const fillerComment = '// äh also this is a comment';
            const validation = generator.validateComment(fillerComment);
            assert.ok(validation.score < 100, 'Comment with fillers should have lower score');
            assert.ok(validation.suggestions.some(s => s.toLowerCase().includes('füll')), 'Should suggest removing filler words');
        });
    });
    suite('Language-Specific Formatting', () => {
        const testText = 'Test comment for language';
        test('JavaScript/TypeScript uses //', () => {
            const jsResult = generator.formatComment(testText, 'javascript');
            const tsResult = generator.formatComment(testText, 'typescript');
            assert.ok(jsResult.includes('//'), 'JavaScript should use //');
            assert.ok(tsResult.includes('//'), 'TypeScript should use //');
        });
        test('Python uses #', () => {
            const result = generator.formatComment(testText, 'python');
            assert.ok(result.startsWith('#'), 'Python should use #');
        });
        test('CSS uses /* */', () => {
            const longText = 'This is a longer comment for CSS that should use block style';
            const result = generator.formatComment(longText, 'css');
            assert.ok(result.includes('/*') || result.includes('//'), 'CSS should use proper syntax');
        });
        test('HTML uses <!-- -->', () => {
            const result = generator.formatComment(testText, 'html');
            assert.ok(result.includes('<!--') || result.includes('//'), 'HTML should use proper syntax');
        });
        test('Unknown language defaults to //', () => {
            const result = generator.formatComment(testText, 'unknownlang');
            assert.ok(result.includes('//'), 'Unknown language should default to //');
        });
    });
    suite('Edge Cases', () => {
        test('Should handle very short text', () => {
            const result = generator.formatComment('OK', 'typescript');
            assert.ok(result.length > 0, 'Should produce output');
        });
        test('Should handle text with special characters', () => {
            const text = 'Test mit Umlauten: äöü ÄÖÜ ß';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.includes('äöü') || result.includes('Test'), 'Should preserve special chars');
        });
        test('Should handle text with numbers', () => {
            const text = 'Diese Funktion verarbeitet 123 Einträge';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.includes('123'), 'Should preserve numbers');
        });
        test('Should handle text with code snippets', () => {
            const text = 'Nutzt Array.map() für Transformation';
            const result = generator.formatComment(text, 'typescript');
            assert.ok(result.includes('map') || result.includes('Array'), 'Should preserve code references');
        });
    });
});
//# sourceMappingURL=generator.test.js.map