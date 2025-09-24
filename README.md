# 🎤 VSCode Voice Documentation Plugin

**KI-gestützte Code-Dokumentation per Spracheingabe**

Ein Visual Studio Code Plugin, das es ermöglicht, Code-Kommentare durch Spracheingabe zu erstellen. Sprechen Sie einfach Ihre Erklärungen und das Plugin konvertiert sie automatisch in gut formatierte Code-Kommentare.

![Demo](https://via.placeholder.com/800x400?text=Voice+Doc+Demo+GIF)

## ✨ Features

- 🎤 **Audio-Aufnahme** mit einem Tastendruck (Ctrl+Alt+R)
- 🤖 **Multiple STT-Provider** (Azure, OpenAI Whisper, Google)
- 🌍 **Mehrsprachig** (Deutsch, Englisch, Französisch, Spanisch, etc.)
- 💬 **Intelligente Kommentargenerierung** mit automatischer Formatierung
- 📝 **Sprachspezifische Kommentare** für verschiedene Programmiersprachen
- 🔒 **Sichere API-Key-Speicherung** über VS Code Secrets API
- ⚡ **Sofortige Integration** direkt in den Editor
- 🎯 **Kontextbezogene Kommentare** basierend auf Code-Kontext

## 🚀 Installation

### Option 1: VS Code Marketplace (empfohlen)
```bash
ext install azad-ahmed.vscode-voice-doc
```

### Option 2: Manuell aus Repository
1. Repository klonen:
   ```bash
   git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
   ```

2. Dependencies installieren:
   ```bash
   cd vscode-voice-doc-plugin
   npm install
   ```

3. Extension kompilieren:
   ```bash
   npm run compile
   ```

4. Extension in VS Code laden:
   - F5 drücken (startet Extension Development Host)
   - Oder VSIX-Paket erstellen: `npm run package`

## ⚙️ Setup & Konfiguration

### 1. STT-Provider wählen

Das Plugin unterstützt mehrere Speech-to-Text-Anbieter:

#### Azure Cognitive Services (Empfohlen)
```bash
# 1. API Key erhalten von: https://portal.azure.com
# 2. In VS Code: Ctrl+Alt+C -> Provider: Azure -> API Key eingeben
```

#### OpenAI Whisper (Lokal & Kostenlos)
```bash
# Installation:
pip install openai-whisper

# Automatische Erkennung durch Plugin
```

#### Google Cloud Speech-to-Text
```bash
# 1. Google Cloud Projekt erstellen
# 2. Speech-to-Text API aktivieren
# 3. API Key generieren und in Plugin konfigurieren
```

### 2. Sprache konfigurieren

```json
// settings.json
{
    "voiceDoc.language": "de-DE",        // Deutsch (Standard)
    "voiceDoc.speechService": "azure",   // STT-Anbieter
    "voiceDoc.autoInsert": true,         // Automatisches Einfügen
    "voiceDoc.commentStyle": "auto"      // Kommentar-Stil
}
```

### 3. Tastenkürzel (optional anpassen)

| Aktion | Standard | Beschreibung |
|--------|----------|-------------|
| Aufnahme starten/stoppen | `Ctrl+Alt+R` | Sprach-Aufnahme |
| Text zu Kommentar | `Ctrl+Alt+T` | Direkteingabe |
| Konfiguration | `Ctrl+Alt+C` | Settings öffnen |

## 📖 Verwendung

### Basis-Workflow

1. **Cursor positionieren** wo der Kommentar eingefügt werden soll
2. **Aufnahme starten**: `Ctrl+Alt+R` drücken
3. **Sprechen**: Erklärung deutlich aussprechen
4. **Aufnahme beenden**: `Ctrl+Alt+R` erneut drücken
5. **Automatische Verarbeitung**: Plugin transkribiert und formatiert
6. **Kommentar wird eingefügt** an Cursor-Position

### Beispiel

**Sie sprechen:**
> "Diese Funktion berechnet den Steuerbetrag basierend auf dem Einkommen und gibt das Ergebnis als Dezimalzahl zurück"

**Plugin generiert:**
```javascript
/**
 * Berechnet den Steuerbetrag basierend auf dem Einkommen
 * und gibt das Ergebnis als Dezimalzahl zurück
 */
function calculateTax(income) {
    // ...
}
```

### Erweiterte Features

#### Kontextuelle Kommentare
```javascript
// Vor einer Funktion sprechen -> Funktionsdokumentation
// Vor einer Variable sprechen -> Variable-Erklärung
// Inline sprechen -> Inline-Kommentar
```

#### Verschiedene Sprachen
```python
# Python
def calculate_tax(income):
    """Berechnet die Steuer basierend auf dem Einkommen"""
    pass

// Java
/**
 * Berechnet die Steuer basierend auf dem Einkommen
 */
public double calculateTax(double income) {
    // ...
}

/* CSS */
.button {
    /* Primärer Button-Stil für die Anwendung */
    background-color: #007acc;
}
```

#### Qualitäts-Validierung
Das Plugin validiert automatisch die Qualität der generierten Kommentare und gibt Verbesserungsvorschläge.

## 🔧 Konfiguration im Detail

### Verfügbare Einstellungen

```json
{
    // STT-Provider
    "voiceDoc.speechService": "azure|whisper|google",
    
    // Sprach-Erkennung
    "voiceDoc.language": "de-DE|en-US|fr-FR|es-ES|it-IT",
    
    // Azure-spezifisch
    "voiceDoc.azure.region": "westeurope|eastus|westus2",
    
    // Kommentar-Formatierung
    "voiceDoc.commentStyle": "auto|single-line|multi-line|doc-style",
    "voiceDoc.maxCommentLength": 120,
    
    // Verhalten
    "voiceDoc.autoInsert": true,
    "voiceDoc.enableValidation": true,
    "voiceDoc.showRecordingStatus": true
}
```

### Kommandos

| Kommando | Beschreibung |
|----------|-------------|
| `Voice Doc: Start Recording` | Sprach-Aufnahme starten |
| `Voice Doc: Stop Recording` | Aufnahme beenden |
| `Voice Doc: Configure Settings` | Interaktive Konfiguration |
| `Voice Doc: Insert from Text` | Text direkt eingeben |
| `Voice Doc: Test STT Providers` | Provider-Verfügbarkeit testen |

## 🛠️ Entwicklung

### Entwicklungsumgebung einrichten

```bash
# Repository klonen
git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
cd vscode-voice-doc-plugin

# Dependencies installieren
npm install

# TypeScript kompilieren (Watch-Modus)
npm run watch

# VS Code Extension Development Host starten
code . 
# Dann F5 drücken
```

### Projekt-Struktur

```
src/
├── extension.ts              # Haupt-Extension
├── generator.ts              # Kommentar-Generator
├── audioRecorder.ts          # Audio-Aufnahme (Legacy)
├── audio/
│   └── recorder.ts          # Neue Audio-Implementation
└── stt/
    ├── factory.ts           # STT-Provider-Factory
    └── providers/
        ├── azure.ts         # Azure Cognitive Services
        ├── whisper.ts       # OpenAI Whisper
        └── webSpeech.ts     # Web Speech API
```

### Neue Features hinzufügen

1. **STT-Provider erweitern**:
   ```typescript
   // src/stt/providers/newProvider.ts
   export class NewProvider implements STTProvider {
       async transcribe(audioPath: string): Promise<string> {
           // Implementation
       }
   }
   ```

2. **Sprach-Support erweitern**:
   ```typescript
   // src/generator.ts - getCommentStyle()
   'newlang': { single: '#', multi: { start: '"""', end: '"""' }}
   ```

### Tests ausführen

```bash
npm run test
```

## 🐛 Troubleshooting

### Häufige Probleme

#### "No STT providers available"
- Azure: API Key konfiguriert? Region korrekt?
- Whisper: `pip install openai-whisper` ausgeführt?
- Rechte: Mikrofon-Berechtigung erteilt?

#### "Recording failed to start"
- **Windows**: FFmpeg installieren oder PowerShell-Berechtigung prüfen
- **macOS**: `rec` installieren: `brew install sox`
- **Linux**: ALSA/PulseAudio konfigurieren

#### "Transcription quality poor"
- Mikrofonqualität verbessern
- Hintergrundgeräusche reduzieren
- Langsamer und deutlicher sprechen
- Korrekte Sprache in Settings wählen

#### "Comments not inserting"
- Cursor in aktivem Editor positioniert?
- Schreibschutz der Datei prüfen
- Extension-Log in Output-Panel prüfen

### Debug-Modus aktivieren

```json
// settings.json
{
    "voiceDoc.debug": true
}
```

Log-Output in: `View` → `Output` → `Voice Doc`

## 🤝 Mitwirken

Beiträge sind willkommen! Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

### Development Workflow

1. Fork des Repositories
2. Feature-Branch erstellen: `git checkout -b feature/amazing-feature`
3. Änderungen committen: `git commit -m 'Add amazing feature'`
4. Branch pushen: `git push origin feature/amazing-feature`
5. Pull Request erstellen

### Coding Standards

- TypeScript mit strict mode
- ESLint-Regeln befolgen
- Tests für neue Features
- Dokumentation aktualisieren

## 📄 Lizenz

Dieses Projekt steht unter der [MIT Lizenz](LICENSE).

## 🙏 Danksagung

- **OpenAI Whisper** für lokale STT-Funktionalität
- **Microsoft Azure** für Cloud-basierte Spracherkennung
- **VS Code Team** für die ausgezeichnete Extension API
- **EDA (Eidgenössisches Departement für Auswärtige Angelegenheiten)** für die Projektinitiative

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/azad-ahmed/vscode-voice-doc-plugin/issues)
- **Diskussionen**: [GitHub Discussions](https://github.com/azad-ahmed/vscode-voice-doc-plugin/discussions)
- **E-Mail**: azad.ahmed@example.com

---

**Made with ❤️ for developers who want to document their code effortlessly.**