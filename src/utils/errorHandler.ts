import * as vscode from 'vscode';

/**
 * Zentrale Fehlerbehandlungsklasse für die Voice Documentation Extension
 * Verwaltet Logging, User-Benachrichtigungen und automatische Wiederholungsversuche
 */
export class ErrorHandler {
    private static outputChannel: vscode.OutputChannel | null = null;

    static initialize(outputChannel: vscode.OutputChannel): void {
        ErrorHandler.outputChannel = outputChannel;
    }

    static handleError(context: string, error: any, showUser: boolean = true): void {
        const message = error?.message || String(error);
        const timestamp = new Date().toLocaleTimeString();

        if (ErrorHandler.outputChannel) {
            ErrorHandler.outputChannel.appendLine(
                `[${timestamp}] ❌ ERROR in ${context}: ${message}`
            );
            if (error?.stack) {
                ErrorHandler.outputChannel.appendLine(`Stack: ${error.stack}`);
            }
        }

        if (showUser) {
            vscode.window
                .showErrorMessage(
                    `Voice Doc Fehler (${context}): ${message}`,
                    'Details anzeigen',
                    'Ignorieren'
                )
                .then((action) => {
                    if (action === 'Details anzeigen' && ErrorHandler.outputChannel) {
                        ErrorHandler.outputChannel.show();
                    }
                });
        }

        console.error(`[${context}]`, error);
    }

    static handleWarning(context: string, message: string, showUser: boolean = true): void {
        const timestamp = new Date().toLocaleTimeString();

        if (ErrorHandler.outputChannel) {
            ErrorHandler.outputChannel.appendLine(
                `[${timestamp}] ⚠️  WARNING in ${context}: ${message}`
            );
        }

        if (showUser) {
            vscode.window.showWarningMessage(`Voice Doc: ${message}`);
        }
    }

    static log(context: string, message: string, level: 'info' | 'success' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const icon = level === 'success' ? '✅' : 'ℹ️';

        if (ErrorHandler.outputChannel) {
            ErrorHandler.outputChannel.appendLine(
                `[${timestamp}] ${icon} [${context}] ${message}`
            );
        }
    }

    static async retry<T>(
        fn: () => Promise<T>,
        options: {
            maxRetries?: number;
            initialDelay?: number;
            maxDelay?: number;
            context?: string;
        } = {}
    ): Promise<T> {
        const {
            maxRetries = 3,
            initialDelay = 1000,
            maxDelay = 10000,
            context = 'unknown'
        } = options;

        let lastError: Error;
        let delay = initialDelay;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                if (attempt < maxRetries) {
                    ErrorHandler.log(
                        context,
                        `Versuch ${attempt} fehlgeschlagen, wiederhole in ${delay}ms...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    delay = Math.min(delay * 2, maxDelay);
                } else {
                    ErrorHandler.handleError(
                        context,
                        `Alle ${maxRetries} Versuche fehlgeschlagen: ${error.message}`,
                        false
                    );
                }
            }
        }

        throw lastError!;
    }
}
