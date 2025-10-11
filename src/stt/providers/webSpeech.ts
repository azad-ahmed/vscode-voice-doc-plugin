import { STTProvider } from '../types';
import * as vscode from 'vscode';

/**
 * Web Speech API Provider (nur theoretisch in Browser verfügbar)
 */
export class WebSpeechProvider implements STTProvider {
    readonly name = 'Web Speech API (Browser)';
    
    async isAvailable(): Promise<boolean> {
        return false;
    }

    async transcribe(audioPath: string, language?: string): Promise<string> {
        throw new Error('Web Speech API nicht in VS Code Extensions verfügbar');
    }
}

/**
 * Simulierter STT Provider für Entwicklung und Testing
 */
export class SimulatedSTTProvider implements STTProvider {
    readonly name = 'Simulated STT (Demo-Modus)';
    
    private simulatedTexts = [
        'Diese Funktion berechnet die Fibonacci-Zahlen rekursiv',
        'Hier wird die Datenbankverbindung initialisiert und konfiguriert',
        'Diese Methode validiert die Benutzereingaben und gibt Fehler zurück',
        'Der Algorithmus sortiert die Liste effizient mit QuickSort',
        'Diese Klasse implementiert das Singleton-Pattern für den Cache',
        'Die Funktion parsed JSON-Daten und validiert das Schema',
        'Hier erfolgt die Authentifizierung über JWT-Tokens',
        'Diese Methode führt eine asynchrone API-Anfrage durch',
        'Der Code implementiert eine Retry-Logik mit exponential backoff',
        'Diese Komponente rendert die Benutzeroberfläche mit React'
    ];

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async transcribe(audioPath: string, language?: string): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const text = this.simulatedTexts[Math.floor(Math.random() * this.simulatedTexts.length)];
        
        vscode.window.showWarningMessage(
            '⚠️ DEMO-MODUS: Simulierte Transkription',
            'OpenAI konfigurieren',
            'Ignorieren'
        ).then(action => {
            if (action === 'OpenAI konfigurieren') {
                vscode.commands.executeCommand('voiceDocPlugin.configureOpenAI');
            }
        });
        
        return text;
    }
}
