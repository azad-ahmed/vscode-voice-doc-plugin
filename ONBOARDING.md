# 🎉 Onboarding-System - Dokumentation

## Überblick

Das neue Onboarding-System begrüßt neue Benutzer beim ersten Start der Extension und führt sie durch den Setup-Prozess. Es bietet eine professionelle, benutzerfreundliche Erfahrung mit:

- 🎨 Visueller Willkommens-Nachricht
- 🔧 Geführte Provider-Auswahl
- ✅ Automatische Verbindungsprüfung
- 📚 Integriertes Tutorial
- 🔄 Wiederholbarkeit für neue Versionen

## Features

### 1. Willkommens-Bildschirm

Beim ersten Start wird ein schöner, animierter Willkommens-Bildschirm angezeigt mit:
- Gradient-Hintergrund
- Übersicht über Haupt-Features
- Automatisches Schließen nach 3 Sekunden

### 2. Provider-Auswahl

Benutzer können zwischen drei Optionen wählen:

#### 🚀 OpenAI Whisper (Empfohlen)
- Beste Qualität
- API-Key erforderlich
- Automatische Verbindungsprüfung

#### ☁️ Azure Cognitive Services
- Enterprise-Lösung
- API-Key + Region erforderlich
- Verbindungstest inkludiert

#### 🎮 Demo-Modus
- Keine API-Keys nötig
- Simulierte Transkriptionen
- Perfekt zum Testen

### 3. Automatische Verbindungsprüfung

Bei der Konfiguration von OpenAI oder Azure:

1. ✅ **API-Key Validierung**
   - Format-Prüfung
   - Längen-Validierung
   - Hilfreiche Fehlermeldungen

2. ✅ **Verbindungstest**
   - Echter API-Call
   - Progress-Indicator
   - Detaillierte Fehleranalyse

3. ✅ **Retry-Mechanismus**
   - Bei Fehlern: "Erneut versuchen"
   - "Anderen Key eingeben"
   - "Abbrechen"

### 4. Tutorial

Nach erfolgreicher Konfiguration:
- Quick-Start-Guide mit 5 Schritten
- Tastenkombinationen
- Pro-Tipps
- Erweiterte Features-Übersicht

## Technische Details

### Architektur

```typescript
OnboardingManager
├── checkAndRunOnboarding()     // Haupteinstiegspunkt
├── showWelcomeMessage()        // Willkommens-Bildschirm
├── selectProvider()            // Provider-Auswahl
├── configureAndTestProvider()  // Konfiguration + Test
│   ├── setupDemoMode()
│   ├── setupOpenAI()          // Mit Verbindungstest
│   └── setupAzure()           // Mit Verbindungstest
├── showSuccessMessage()        // Erfolgs-Bestätigung
└── showQuickTutorial()         // Tutorial-Anzeige
```

### State Management

Das Onboarding verwendet VS Code's `globalState` für persistente Speicherung:

```typescript
// Keys
'voiceDoc.hasCompletedOnboarding'  // boolean
'voiceDoc.onboardingVersion'       // string (z.B. "1.0.0")
```

**Versioning-Strategie:**
- Bei neuer Version wird Onboarding erneut angezeigt
- Ermöglicht Update-Nachrichten
- Benutzer kann Updates überspringen

### Provider-Tests

#### OpenAI Test
```typescript
const provider = new OpenAIWhisperProvider(apiKey);
const isAvailable = await provider.isAvailable();
```

#### Azure Test
```typescript
const provider = new AzureSTTProvider(apiKey, region);
const isAvailable = await provider.isAvailable();
```

## User Flow

```
START
  ↓
[Willkommens-Bildschirm]
  ↓
[Provider-Auswahl]
  ├─→ Demo-Modus
  │     ↓
  │   [Aktiviert]
  │     ↓
  │   [Erfolgs-Message]
  │
  ├─→ OpenAI
  │     ↓
  │   [API-Key eingeben]
  │     ↓
  │   [Verbindung testen]
  │     ├─→ Erfolg → [Speichern] → [Erfolgs-Message]
  │     └─→ Fehler → [Retry-Dialog]
  │
  └─→ Azure
        ↓
      [API-Key eingeben]
        ↓
      [Region auswählen]
        ↓
      [Verbindung testen]
        ├─→ Erfolg → [Speichern] → [Erfolgs-Message]
        └─→ Fehler → [Retry-Dialog]
          
[Quick-Start-Tutorial] (optional)
  ↓
FERTIG
```

## Commands

### voiceDocPlugin.resetOnboarding

Setzt das Onboarding zurück für Testing oder erneute Durchführung.

**Verwendung:**
```
Ctrl+Shift+P → "Voice Doc: Onboarding zurücksetzen"
```

**Effekt:**
- Löscht Onboarding-Status
- Löscht Version-Status
- Zeigt Bestätigung
- Erfordert VS Code Neustart für erneutes Onboarding

## Internationalisierung

**Aktuell:** Deutsch (de-DE)

**Zukünftig erweiterbar:**
```typescript
// Beispiel für i18n-Integration
const messages = {
    'de-DE': {
        welcome: 'Willkommen bei Voice Documentation!',
        // ...
    },
    'en-US': {
        welcome: 'Welcome to Voice Documentation!',
        // ...
    }
};
```

## Styling

### Willkommens-Bildschirm
- Gradient-Hintergrund (Purple → Violet)
- Fade-in Animationen
- Glasmorphism-Effekt für Feature-Box
- Responsive Design

### Tutorial
- VS Code Theme-Integration
- Konsistente Typografie
- Code-Highlighting für Tastenkombinationen
- Strukturierte Step-by-Step Anleitung

## Testing

### Manuelles Testing

1. **Erststart testen:**
   ```bash
   # Extension installieren
   code --install-extension voiceDocPlugin-1.0.0.vsix
   
   # VS Code starten - Onboarding sollte erscheinen
   ```

2. **Onboarding zurücksetzen:**
   ```
   Ctrl+Shift+P → "Voice Doc: Onboarding zurücksetzen"
   VS Code neu starten
   ```

3. **Provider-Tests:**
   - OpenAI mit gültigem Key
   - OpenAI mit ungültigem Key
   - Azure mit gültigen Credentials
   - Azure mit ungültigen Credentials
   - Demo-Modus

### Automatisierte Tests

```typescript
describe('OnboardingManager', () => {
    it('should detect first start', async () => {
        const context = createMockContext();
        const needsOnboarding = await OnboardingManager.checkAndRunOnboarding(context);
        assert.strictEqual(needsOnboarding, true);
    });

    it('should not show onboarding on second start', async () => {
        const context = createMockContext();
        await context.globalState.update('voiceDoc.hasCompletedOnboarding', true);
        const needsOnboarding = await OnboardingManager.checkAndRunOnboarding(context);
        assert.strictEqual(needsOnboarding, false);
    });
});
```

## Fehlerbehandlung

### Mögliche Fehler und Lösungen

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| API-Key ungültig | Falscher Key | Retry mit korrektem Key |
| Verbindung fehlgeschlagen | Netzwerk/Firewall | Proxy-Settings prüfen |
| Region nicht verfügbar | Azure-Region falsch | Andere Region wählen |
| Timeout | Langsame Verbindung | Retry oder Demo-Modus |

### Error Recovery

```typescript
try {
    await provider.isAvailable();
} catch (error) {
    const action = await vscode.window.showErrorMessage(
        `Verbindung fehlgeschlagen: ${error.message}`,
        'Erneut versuchen',
        'Anderen Key eingeben',
        'Abbrechen'
    );
    // Handle action...
}
```

## Best Practices

### Provider-Auswahl

**OpenAI Whisper:**
- ✅ Beste für Deutsch
- ✅ Schnellste Verarbeitung
- ✅ Günstigste Option
- ⚠️ Erfordert Internet

**Azure:**
- ✅ Enterprise-Support
- ✅ Compliance (GDPR)
- ✅ SLA verfügbar
- ⚠️ Höhere Latenz
- ⚠️ Teurer

**Demo-Modus:**
- ✅ Kein Setup nötig
- ✅ Offline verfügbar
- ✅ Testing-Freundlich
- ⚠️ Keine echte Transkription

## Zukünftige Erweiterungen

### Geplante Features

1. **Multi-Step Wizard**
   - Erweiterte Einstellungen
   - Sprach-Auswahl
   - Kommentar-Stil
   - Tastenkombinationen

2. **Interactive Tutorial**
   - Geführte Demo
   - Practice-Modus
   - Achievement-System

3. **Team-Onboarding**
   - Shared Configurations
   - Team-Templates
   - Admin-Presets

4. **Analytics**
   - Onboarding-Abschlussrate
   - Drop-off-Analyse
   - A/B-Testing

## Maintenance

### Version-Updates

Beim Release einer neuen Version:

1. Update `CURRENT_VERSION` in `onboardingManager.ts`
2. Entscheide ob Re-Onboarding nötig
3. Update Willkommens-Text mit "Was ist neu"

```typescript
private static readonly CURRENT_VERSION = '1.1.0'; // Update hier
```

### Monitoring

Log wichtige Events:
```typescript
ErrorHandler.log('Onboarding', 'User selected OpenAI', 'info');
ErrorHandler.log('Onboarding', 'Connection test succeeded', 'success');
```

## Support

Bei Problemen:
1. Prüfe Output-Channel "Voice Documentation"
2. Teste STT-Provider manuell: `Ctrl+Shift+P → "Voice Doc: STT-Provider testen"`
3. Reset Onboarding: `Ctrl+Shift+P → "Voice Doc: Onboarding zurücksetzen"`

---

**Autor:** Azad Ahmed  
**Datum:** November 2025  
**Version:** 1.0.0
