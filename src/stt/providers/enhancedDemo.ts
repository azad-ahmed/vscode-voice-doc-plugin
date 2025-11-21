import { STTProvider } from '../types';
import * as path from 'path';

/**
 * Perfekt für Diplomarbeit-Tests und Demonstrationen ohne API-Keys
 */
export class EnhancedDemoProvider implements STTProvider {
    readonly name = 'Enhanced Demo Mode (KI-Simuliert)';

    private demoTranscriptions = {
        // Funktions-Dokumentationen
        functions: [
            'Diese Funktion berechnet die Summe aller Elemente im Array',
            'Die Methode validiert die Benutzereingaben und gibt true zurück wenn alles korrekt ist',
            'Diese Funktion implementiert den Binary Search Algorithmus für sortierte Arrays',
            'Die Methode sendet eine HTTP-Anfrage an die API und verarbeitet die Antwort',
            'Diese Funktion konvertiert das Datum in das ISO-Format für die Datenbank',
            'Die Methode initialisiert die Datenbankverbindung mit den Konfigurations-Parametern',
            'Diese Funktion filtert die Liste nach aktiven Benutzern und sortiert sie alphabetisch',
            'Die Methode verschlüsselt das Passwort mit bcrypt bevor es gespeichert wird',
            'Diese Funktion generiert ein eindeutiges Token für die Authentifizierung',
            'Die Methode aktualisiert den Status in der Datenbank und sendet eine Benachrichtigung',
        ],

        // Klassen-Dokumentationen
        classes: [
            'Diese Klasse verwaltet die Benutzer-Authentifizierung und Session-Verwaltung',
            'Die Klasse implementiert das Repository-Pattern für Datenbankzugriffe',
            'Diese Klasse dient als Controller für alle API-Endpunkte der Benutzer-Verwaltung',
            'Die Klasse kapselt die Geschäftslogik für die Bestellverarbeitung',
            'Diese Service-Klasse kümmert sich um die E-Mail-Versendung mit Templates',
            'Die Klasse implementiert das Singleton-Pattern für die Konfigurationsverwaltung',
            'Diese Utility-Klasse bietet Helper-Funktionen für String-Operationen',
            'Die Klasse managed den WebSocket-Verbindungspool für Echtzeit-Updates',
        ],

        // Variable-Dokumentationen
        variables: [
            'Diese Variable speichert die Konfiguration für die Datenbankverbindung',
            'Die Konstante definiert das maximale Upload-Limit in Megabytes',
            'Diese Variable cached die letzten Suchergebnisse zur Performance-Optimierung',
            'Der Counter zählt die Anzahl der fehlgeschlagenen Login-Versuche',
            'Diese Map speichert die aktiven Benutzer-Sessions mit ihren IDs',
            'Die Variable hält den aktuellen Zustand der Anwendung im State-Management',
            'Dieser Flag zeigt an ob die Komponente gerade lädt oder bereit ist',
        ],

        // Allgemeine Code-Erklärungen
        general: [
            'Dieser Code-Block implementiert die Fehlerbehandlung mit try-catch',
            'Die Schleife iteriert über alle Elemente und transformiert sie',
            'Dieser Abschnitt validiert die Eingabedaten vor der Verarbeitung',
            'Der Code verwendet async-await für asynchrone Operationen',
            'Dieser Teil kümmert sich um die Logging-Funktionalität',
            'Die Bedingung prüft ob der Benutzer die nötigen Berechtigungen hat',
            'Dieser Code erstellt eine neue Instanz und initialisiert die Properties',
            'Der Block implementiert die Pagination für große Datenmengen',
        ],

        // TypeScript/JavaScript spezifisch
        typescript: [
            'Diese Interface definiert die Struktur für Benutzer-Objekte mit TypeScript',
            'Der Type Guard prüft zur Laufzeit ob das Objekt dem erwarteten Typ entspricht',
            'Diese generische Funktion arbeitet mit verschiedenen Datentypen',
            'Das Enum definiert alle möglichen Status-Werte für die Bestellung',
            'Dieser Decorator fügt Logging-Funktionalität zur Methode hinzu',
            'Die Arrow-Function wird als Callback für die Array-Transformation verwendet',
            'Dieser Type Alias vereinfacht die Verwendung komplexer Union-Types',
        ],

        // Python spezifisch
        python: [
            'Diese Funktion nutzt List Comprehension für die Daten-Transformation',
            'Der Decorator fügt Caching-Funktionalität zur Funktion hinzu',
            'Diese Klasse erbt von der Basis-Klasse und überschreibt die Methoden',
            'Die Funktion verwendet *args und **kwargs für flexible Parameter',
            'Dieser Context Manager kümmert sich um das Ressourcen-Management',
            'Die Property ermöglicht den Zugriff auf private Attribute',
            'Diese Lambda-Funktion wird für die Sortierung verwendet',
        ],

        // Database/SQL
        database: [
            'Diese Query holt alle aktiven Benutzer sortiert nach Erstellungsdatum',
            'Der JOIN verknüpft die Tabellen über die Foreign-Key-Beziehung',
            'Diese Transaktion stellt sicher dass alle Operationen atomar ausgeführt werden',
            'Der Index optimiert die Suchperformance für häufige Abfragen',
            'Diese Stored Procedure kapselt die komplexe Geschäftslogik',
        ],

        // Frontend/UI
        frontend: [
            'Diese Komponente rendert die Benutzer-Liste mit Pagination',
            'Der Hook verwaltet den lokalen State der Komponente',
            'Diese Event-Handler-Funktion reagiert auf Button-Klicks',
            'Der Effect läuft nach jedem Render und lädt die Daten',
            'Diese Style-Definition verwendet CSS-in-JS für das Styling',
            'Der Reducer verwaltet die komplexen State-Änderungen',
        ],
    };

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async transcribe(audioPath: string, language?: string): Promise<string> {
        // Simuliere realistische Verarbeitungszeit (500-1500ms)
        const delay = 500 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Versuche intelligente Auswahl basierend auf Dateinamen
        const fileName = path.basename(audioPath).toLowerCase();
        
        // Analysiere den Kontext aus dem Dateinamen falls möglich
        if (fileName.includes('function') || fileName.includes('method')) {
            return this.getRandomFromCategory('functions');
        }
        if (fileName.includes('class')) {
            return this.getRandomFromCategory('classes');
        }
        if (fileName.includes('variable') || fileName.includes('const')) {
            return this.getRandomFromCategory('variables');
        }
        if (fileName.includes('typescript') || fileName.includes('ts')) {
            return this.getRandomFromCategory('typescript');
        }
        if (fileName.includes('python') || fileName.includes('py')) {
            return this.getRandomFromCategory('python');
        }
        if (fileName.includes('database') || fileName.includes('sql')) {
            return this.getRandomFromCategory('database');
        }
        if (fileName.includes('component') || fileName.includes('ui')) {
            return this.getRandomFromCategory('frontend');
        }

        // Fallback: Zufällige realistische Transkription
        return this.getRandomTranscription();
    }

    private getRandomFromCategory(category: keyof typeof this.demoTranscriptions): string {
        const items = this.demoTranscriptions[category];
        return items[Math.floor(Math.random() * items.length)];
    }

    private getRandomTranscription(): string {
        const allCategories = Object.keys(this.demoTranscriptions) as Array<keyof typeof this.demoTranscriptions>;
        const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
        return this.getRandomFromCategory(randomCategory);
    }
}