// Test Suite für AST Analyzer
import * as assert from 'assert';
import { ASTAnalyzer } from '../../src/offline-intelligence/astAnalyzerAdapter';

suite('AST Analyzer - Code Element Detection', () => {
    let analyzer: ASTAnalyzer;

    setup(() => {
        analyzer = new ASTAnalyzer();
    });

    test('Sollte einfache Funktion erkennen', () => {
        const code = `
function add(a: number, b: number): number {
    return a + b;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.strictEqual(elements.length, 1, 'Sollte genau 1 Element finden');
        assert.ok(elements[0], 'Element sollte existieren');
        assert.strictEqual(elements[0].type, 'function', 'Element sollte Funktion sein');
        assert.strictEqual(elements[0].name, 'add', 'Funktionsname sollte "add" sein');
        assert.strictEqual(elements[0].parameters?.length || 0, 2, 'Sollte 2 Parameter haben');
    });

    test('Sollte Klasse erkennen', () => {
        const code = `
export class Calculator {
    add(a: number, b: number): number {
        return a + b;
    }
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        // Sollte Klasse + Methode finden
        assert.ok(elements.length >= 1, 'Sollte mindestens 1 Element finden');
        
        const classElement = elements.find(e => e.type === 'class');
        assert.ok(classElement, 'Sollte Klasse finden');
        if (classElement) {
            assert.strictEqual(classElement.name, 'Calculator', 'Klassenname sollte "Calculator" sein');
        }
    });

    test('Sollte Interface erkennen', () => {
        const code = `
interface User {
    name: string;
    age: number;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.strictEqual(elements.length, 1, 'Sollte genau 1 Element finden');
        assert.ok(elements[0], 'Element sollte existieren');
        assert.strictEqual(elements[0].type, 'interface', 'Element sollte Interface sein');
        assert.strictEqual(elements[0].name, 'User', 'Interface-Name sollte "User" sein');
    });

    test('Sollte mehrere Elemente erkennen', () => {
        const code = `
class MyClass {
    method1() {}
    method2() {}
}

function myFunction() {}

interface MyInterface {}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(elements.length >= 3, 'Sollte mindestens 3 Elemente finden');
        
        const hasClass = elements.some(e => e.type === 'class');
        const hasFunction = elements.some(e => e.type === 'function');
        const hasInterface = elements.some(e => e.type === 'interface');
        
        assert.ok(hasClass, 'Sollte Klasse finden');
        assert.ok(hasFunction, 'Sollte Funktion finden');
        assert.ok(hasInterface, 'Sollte Interface finden');
    });
});

suite('AST Analyzer - Complexity Calculation', () => {
    let analyzer: ASTAnalyzer;

    setup(() => {
        analyzer = new ASTAnalyzer();
    });

    test('Sollte einfache Komplexität = 1 haben', () => {
        const code = `
function simple(): void {
    console.log('Hello');
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(elements[0], 'Element sollte existieren');
        assert.strictEqual(elements[0].complexity, 1, 'Einfache Funktion sollte Komplexität 1 haben');
    });

    test('Sollte Komplexität mit IF erhöhen', () => {
        const code = `
function withIf(x: number): number {
    if (x > 0) {
        return x;
    }
    return 0;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(elements[0], 'Element sollte existieren');
        assert.ok(elements[0].complexity >= 2, 'Funktion mit IF sollte Komplexität >= 2 haben');
    });

    test('Sollte komplexe Funktion korrekt bewerten', () => {
        const code = `
function complex(x: number): number {
    if (x > 0) {
        for (let i = 0; i < x; i++) {
            if (i % 2 === 0) {
                return i;
            }
        }
    }
    return 0;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(elements[0], 'Element sollte existieren');
        // 1 (base) + 1 (if) + 1 (for) + 1 (if) = 4
        assert.ok(elements[0].complexity >= 4, 'Komplexe Funktion sollte Komplexität >= 4 haben');
    });
});

suite('AST Analyzer - Comment Detection', () => {
    let analyzer: ASTAnalyzer;

    setup(() => {
        analyzer = new ASTAnalyzer();
    });

    test('Sollte JSDoc-Kommentar erkennen', () => {
        const code = `
/**
 * Addiert zwei Zahlen
 */
function add(a: number, b: number): number {
    return a + b;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(elements[0], 'Element sollte existieren');
        assert.strictEqual(elements[0].hasComment, true, 'Sollte JSDoc-Kommentar erkennen');
    });

    test('Sollte fehlenden Kommentar erkennen', () => {
        const code = `
function divide(a: number, b: number): number {
    return a / b;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(elements[0], 'Element sollte existieren');
        assert.strictEqual(elements[0].hasComment, false, 'Sollte fehlenden Kommentar erkennen');
    });
});

suite('AST Analyzer - Statistics', () => {
    let analyzer: ASTAnalyzer;

    setup(() => {
        analyzer = new ASTAnalyzer();
    });

    test('Sollte korrekte Statistiken generieren', () => {
        const code = `
/**
 * Dokumentierte Funktion
 */
function documented(): void {}

function undocumented(): void {}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        const stats = analyzer.getStatistics(elements);
        
        assert.ok(stats.total > 0, 'Sollte Elemente finden');
        assert.ok(stats.avgComplexity >= 1, 'Durchschnittliche Komplexität sollte >= 1 sein');
    });

    test('Sollte undokumentierte Elemente finden', () => {
        const code = `
function one(): void {}
function two(): void {}
/**
 * Kommentiert
 */
function three(): void {}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        const undocumented = analyzer.findUndocumented(elements);
        
        assert.ok(undocumented.length >= 1, 'Sollte mindestens 1 undokumentierte Funktion finden');
    });

    test('Sollte komplexe Funktionen finden', () => {
        const code = `
function simple(): void {}

function complex(x: number): number {
    if (x > 0) {
        for (let i = 0; i < x; i++) {
            if (i % 2 === 0) {
                return i;
            }
        }
    }
    return 0;
}
        `;
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        const complexFunctions = analyzer.findComplexFunctions(elements, 3);
        
        assert.ok(complexFunctions.length >= 1, 'Sollte mindestens 1 komplexe Funktion finden');
        
        const complexFunc = complexFunctions.find(f => f.name === 'complex');
        assert.ok(complexFunc, 'Sollte "complex" Funktion finden');
    });
});

suite('AST Analyzer - Error Handling', () => {
    let analyzer: ASTAnalyzer;

    setup(() => {
        analyzer = new ASTAnalyzer();
    });

    test('Sollte ungültigen Code handhaben', () => {
        const code = `
function broken( {
    // Syntaxfehler
        `;
        
        // Sollte nicht crashen, sondern leeres Array zurückgeben
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.ok(Array.isArray(elements), 'Sollte Array zurückgeben');
    });

    test('Sollte leeren Code handhaben', () => {
        const code = '';
        
        const elements = analyzer.analyzeCode(code, 'test.ts');
        
        assert.strictEqual(elements.length, 0, 'Sollte leeres Array für leeren Code zurückgeben');
    });
});
