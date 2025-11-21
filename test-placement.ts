// Test-Datei für intelligente Kommentarplatzierung

export class Calculator {
    private result: number = 0;

    add(a: number, b: number): number {
        return a + b;
    }

    subtract(a: number, b: number): number {
        return a - b;
    }

    multiply(a: number, b: number): number {
        return a * b;
    }

    divide(a: number, b: number): number {
        if (b === 0) {
            throw new Error('Division by zero');
        }
        return a / b;
    }

    complexCalculation(x: number, y: number, z: number): number {
        let result = 0;
        
        if (x > 0) {
            result += x * 2;
        }
        
        if (y > 0) {
            result += y * 3;
        }
        
        for (let i = 0; i < z; i++) {
            result += i;
        }
        
        return result;
    }
}

export function factorial(n: number): number {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

const squareArrow = (x: number): number => x * x;

interface MathOperation {
    execute(a: number, b: number): number;
}
