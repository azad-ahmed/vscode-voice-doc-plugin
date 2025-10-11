# Beitragen zum Voice Documentation Plugin

Vielen Dank für Ihr Interesse, zum Voice Documentation Plugin beizutragen! Diese Anleitung hilft Ihnen, loszulegen.

## Code of Conduct

Dieses Projekt folgt einem Code of Conduct. Durch Ihre Teilnahme stimmen Sie zu, diesen einzuhalten.

## Wie kann ich beitragen?

### Fehler melden

Bevor Sie einen Fehler melden, überprüfen Sie bitte:
- Die [bestehenden Issues](https://github.com/azad-ahmed/vscode-voice-doc-plugin/issues)
- Die [Dokumentation](README.md)

Wenn Sie einen neuen Fehler gefunden haben:

1. Öffnen Sie ein neues Issue
2. Verwenden Sie einen klaren Titel
3. Beschreiben Sie das Problem detailliert:
   - Erwartetes Verhalten
   - Tatsächliches Verhalten
   - Schritte zur Reproduktion
   - VS Code Version
   - Betriebssystem
   - Extension Version
   - Logs aus dem Output-Channel

### Feature-Vorschläge

Feature-Vorschläge sind willkommen! Bitte:

1. Überprüfen Sie, ob das Feature bereits vorgeschlagen wurde
2. Beschreiben Sie das Feature detailliert
3. Erklären Sie den Nutzen
4. Fügen Sie Beispiele hinzu, wenn möglich

### Code-Beiträge

#### Entwicklungsumgebung einrichten

1. **Repository forken und klonen**
```bash
git clone https://github.com/IHR-USERNAME/vscode-voice-doc-plugin.git
cd vscode-voice-doc-plugin
```

2. **Dependencies installieren**
```bash
npm install
```

3. **Extension kompilieren**
```bash
npm run compile
```

4. **Tests ausführen**
```bash
npm test
```

5. **Extension debuggen**
- Drücken Sie `F5` in VS Code
- Dies öffnet ein neues VS Code Fenster mit der Extension

#### Projekt-Struktur verstehen

```
src/
├── extension.ts              # Extension Entry Point
├── generator.ts              # Kommentar-Generator
├── integratedVoiceHandler.ts # Voice-Workflow
├── audio/
│   └── recorder.ts           # Audio-Aufnahme
├── stt/
│   ├── factory.ts            # Provider Factory
│   ├── types.ts              # Interfaces
│   └── providers/            # STT Implementierungen
└── utils/                    # Hilfsfunktionen
    ├── errorHandler.ts
    ├── configManager.ts
    ├── fileSystemHelper.ts
    ├── audioQualityValidator.ts
    └── apiUsageTracker.ts
```

#### Code-Richtlinien

**TypeScript**
- Verwenden Sie TypeScript strict mode
- Alle Funktionen müssen Typen haben
- Vermeiden Sie `any` wo möglich
- Nutzen Sie Interfaces für komplexe Strukturen

**Naming Conventions**
- Klassen: `PascalCase` (z.B. `CommentGenerator`)
- Funktionen/Methoden: `camelCase` (z.B. `formatComment`)
- Konstanten: `UPPER_SNAKE_CASE` (z.B. `MAX_RECORDING_TIME`)
- Private Member: Präfix `_` (z.B. `_isRecording`)

**Kommentare**
- Verwenden Sie JSDoc für alle Public APIs
- Inline-Kommentare für komplexe Logik
- Deutsch oder Englisch (konsistent innerhalb einer Datei)

**Fehlerbehandlung**
- Nutzen Sie den zentralen `ErrorHandler`
- Verwenden Sie `try-catch-finally` Blöcke
- Geben Sie aussagekräftige Fehlermeldungen

**Beispiel**:
```typescript
/**
 * Formatiert einen Text zu einem Code-Kommentar
 * @param text Der zu formatierende Text
 * @param languageId Die Programmiersprache
 * @returns Formatierter Kommentar
 */
public formatComment(text: string, languageId: string): string {
    if (!text || text.trim().length === 0) {
        return '// Keine Eingabe';
    }
    
    try {
        const cleaned = this.cleanText(text);
        return this.generateComment(cleaned, languageId);
    } catch (error) {
        ErrorHandler.handleError('formatComment', error);
        throw error;
    }
}
```

#### Testing

**Alle neuen Features benötigen Tests!**

1. **Unit-Tests schreiben**
```typescript
suite('Mein Feature', () => {
    test('sollte X tun', () => {
        const result = myFunction(input);
        assert.strictEqual(result, expected);
    });
});
```

2. **Tests ausführen**
```bash
npm test
```

3. **Test-Coverage prüfen**
- Ziel: Mindestens 70% Coverage für neue Features

#### Pull Request erstellen

1. **Branch erstellen**
```bash
git checkout -b feature/mein-feature
```

2. **Änderungen committen**
```bash
git add .
git commit -m "feat: Beschreibung des Features"
```

Commit-Message-Format:
- `feat:` Neues Feature
- `fix:` Bugfix
- `docs:` Dokumentation
- `test:` Tests
- `refactor:` Code-Refactoring
- `style:` Formatierung
- `perf:` Performance-Verbesserung

3. **Tests ausführen**
```bash
npm test
npm run lint
```

4. **Push und PR erstellen**
```bash
git push origin feature/mein-feature
```

5. **PR-Beschreibung**
- Beschreiben Sie die Änderungen
- Referenzieren Sie Related Issues
- Fügen Sie Screenshots hinzu (wenn UI-Änderungen)

#### Code Review Prozess

1. Alle PRs werden reviewt
2. CI muss grün sein
3. Mindestens 1 Approval erforderlich
4. Squash & Merge in main branch

## Entwickler-Ressourcen

### Wichtige Dateien

- `package.json` - Extension Manifest
- `tsconfig.json` - TypeScript Konfiguration
- `.eslintrc.json` - Linting Regeln
- `CHANGELOG.md` - Versionshistorie

### Nützliche Commands

```bash
npm run compile        # TypeScript kompilieren
npm run watch          # Watch mode
npm test              # Tests ausführen
npm run lint          # Code linting
npm run package       # .vsix erstellen
```

### Debugging

**Extension debuggen:**
1. Setzen Sie Breakpoints in VS Code
2. Drücken Sie `F5`
3. Extension wird im Debug-Modus gestartet

**Tests debuggen:**
1. Öffnen Sie Test-Datei
2. Setzen Sie Breakpoints
3. Wählen Sie "Extension Tests" in Debug-Panel
4. Drücken Sie `F5`

### API-Dokumentation

- [VS Code Extension API](https://code.visualstudio.com/api)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Azure Speech Services](https://docs.microsoft.com/azure/cognitive-services/speech-service/)

## Häufige Aufgaben

### Neuen STT-Provider hinzufügen

1. Interface implementieren:
```typescript
// src/stt/providers/myProvider.ts
export class MySTTProvider implements STTProvider {
    readonly name = 'My Provider';
    
    async isAvailable(): Promise<boolean> { /* ... */ }
    async transcribe(audioPath: string, language?: string): Promise<string> { /* ... */ }
}
```

2. Factory erweitern:
```typescript
// src/stt/factory.ts
case 'my-provider':
    return new MySTTProvider(config.apiKey);
```

3. Tests schreiben
4. Dokumentation aktualisieren

### Neue Programmiersprache unterstützen

Erweitern Sie `getCommentStyle()` in `generator.ts`:
```typescript
'mylang': { 
    single: '//', 
    multi: { start: '/**', end: ' */' } 
}
```

## Fragen?

- Öffnen Sie ein Issue für Fragen
- Schauen Sie in bestehende Issues
- Lesen Sie die Dokumentation

## Lizenz

Mit Ihren Beiträgen stimmen Sie zu, dass Ihr Code unter der MIT-Lizenz lizenziert wird.

---

Vielen Dank für Ihren Beitrag! 🎉
