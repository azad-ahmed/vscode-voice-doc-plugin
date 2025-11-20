# 🎙️ VoiceDoc - KI-gestütztes VS Code Plug-in zur Code-Dokumentation

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-brightgreen.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Diplomarbeit von Azad Ahmed - TEKO Swiss Technical School  
> **Thema:** KI-gestütztes VS Code Plug-in zur Code-Dokumentation

## 📋 Überblick

VoiceDoc ist eine innovative VS Code Extension, die Sprachaufnahmen während des Programmierens in strukturierte Code-Kommentare umwandelt. Das Plugin nutzt modernste KI-Technologien (OpenAI Whisper, GPT-4) um Entwicklern bei der Dokumentation zu helfen.

### ✨ Hauptfunktionen

- 🎙️ **Sprachaufnahme** - Nehme deine Gedanken während des Codierens auf
- 🤖 **KI-Transkription** - Automatische Umwandlung mit mehreren STT-Providern
- 📝 **Intelligente Kommentare** - GPT-4 generiert strukturierte Dokumentation
- 🎯 **Präzise Platzierung** - AST-basierte Analyse für korrekte Kommentar-Position
- 🧠 **Lern-System** - Passt sich deinem Coding-Stil an
- 📊 **Auto-Mode** - Automatische Dokumentation komplexer Funktionen

## 🚀 Installation

### Voraussetzungen

- Node.js >= 18.x
- VS Code >= 1.80.0
- OpenAI API Key (optional, für KI-Features)

### Projekt Setup

```bash
# Repository klonen
git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
cd vscode-voice-doc-plugin

# Dependencies installieren
npm install

# TypeScript kompilieren
npm run compile

# Extension testen (öffnet VS Code Extension Host)
# Drücke F5 in VS Code
```

## 🎯 Verwendung

### Basis-Workflow

1. **Sprachaufnahme starten**
   - Hotkey: `Ctrl+Shift+R` (Windows/Linux) oder `Cmd+Shift+R` (Mac)
   - Oder: Rechtsklick → "Voice Doc: Kommentar aufnehmen"

2. **Spreche deine Erklärung**
   - Beschreibe was der Code macht und warum
   - Mehrere Sätze möglich

3. **Aufnahme beenden**
   - Erneut Hotkey drücken
   - Oder: Stop-Button klicken

4. **Review & Insert**
   - Prüfe den generierten Kommentar
   - Bearbeite bei Bedarf
   - Füge ein mit "Einfügen"

### Auto-Mode (Neu! 🎉)

Der verbesserte Auto-Mode dokumentiert automatisch komplexe Funktionen:

```typescript
// Aktiviere Auto-Mode
Ctrl+Shift+A

// Schreibe eine komplexe Funktion
async function processUserData(users: User[], filters: Filter[]): Promise<Result> {
    // Komplexe Logik mit Schleifen, Bedingungen, etc.
    // ...
}

// → Auto-Mode erkennt Komplexität
// → Generiert automatisch Dokumentation
// → Zeigt Notification mit Preview
// → Du entscheidest: Einfügen, Bearbeiten oder Ignorieren
```

**Auto-Mode Features:**

- ✅ **Komplexitäts-Analyse** - Nur komplexe Funktionen (Score > 15)
- ✅ **Qualitäts-Validierung** - 6 Qualitätskriterien, Score 0-100
- ✅ **Adaptive Wartezeit** - 3-15 Sekunden basierend auf Kontext
- ✅ **Rate-Limiting** - Max 30 API-Calls/Stunde
- ✅ **Lern-System** - Passt sich an Akzeptanz-Rate an

Siehe [Auto-Mode Dokumentation](src/automode/improved/README.md) für Details.

## 🏗️ Architektur

### Komponenten-Übersicht

```
vscode-voice-doc-plugin/
├── src/
│   ├── analysis/          # Code-Analyse (GPT-4)
│   ├── audio/             # Sprachaufnahme
│   ├── stt/               # Speech-to-Text Provider
│   ├── automode/          # Auto-Dokumentation
│   │   └── improved/      # ✨ Verbesserter Auto-Mode
│   ├── learning/          # Lern-System
│   ├── placement/         # Intelligente Kommentar-Platzierung
│   ├── utils/             # Hilfsfunktionen
│   └── extension.ts       # Main Extension Entry
├── package.json           # Extension Manifest
└── tsconfig.json          # TypeScript Config
```

### Technologie-Stack

- **Frontend:** VS Code Extension API
- **Backend:** Node.js, TypeScript 5.0
- **KI-Services:**
  - OpenAI Whisper (Speech-to-Text)
  - GPT-4 (Kommentar-Generierung)
  - Azure Cognitive Services (STT Alternative)
- **Code-Analyse:** TypeScript Compiler API (AST)

## 📊 Features im Detail

### 1. Multi-Provider STT

Unterstützt mehrere Speech-to-Text Anbieter:

- ✅ **OpenAI Whisper** (Empfohlen)
- ✅ **Azure Cognitive Services**
- ✅ **Web Speech API** (Browser-basiert)
- ✅ **Demo-Mode** (Offline-Testing)

### 2. Intelligente Platzierung

AST-basierte Analyse für präzise Kommentar-Platzierung:

- Erkennt Funktionen, Klassen, Methoden
- Berücksichtigt Syntax-Kontext
- Verhindert Syntax-Fehler
- Validiert vor dem Einfügen

### 3. Lern-System

Passt sich an deinen Coding-Stil an:

- Speichert akzeptierte Kommentare
- Findet ähnliche Code-Muster
- Verbessert Vorschläge über Zeit
- User-Profiling

### 4. Qualitäts-Validierung (Neu!)

6 Qualitätskriterien für Kommentare:

1. **Länge** - Nicht zu kurz, nicht zu lang
2. **Meta-Beschreibungen** - Vermeidet "dieser Code..."
3. **Redundanz** - Keine Wiederholung des Codes
4. **"Warum"** - Erklärt Zweck und Grund
5. **Generisch** - Vermeidet allgemeine Phrasen
6. **Sprache** - Korrekte Grammatik

## ⚙️ Konfiguration

Öffne VS Code Settings (`Ctrl+,`) und suche nach "voiceDocPlugin":

```json
{
  // STT Provider
  "voiceDocPlugin.sttProvider": "whisper",
  
  // Auto-Mode
  "voiceDocPlugin.autoMode.enabled": true,
  "voiceDocPlugin.autoMode.minComplexity": 15,
  "voiceDocPlugin.autoMode.baseDelay": 5000,
  "voiceDocPlugin.autoMode.maxCallsPerHour": 30,
  
  // Qualität
  "voiceDocPlugin.autoMode.qualityThreshold": 60,
  
  // Learning
  "voiceDocPlugin.learningEnabled": true
}
```

### API Keys einrichten

```bash
# Methode 1: Environment Variable
export OPENAI_API_KEY="sk-..."

# Methode 2: VS Code Command
> Voice Doc: Set OpenAI API Key
```

## 📈 Performance & Metriken

### Ziele (aus Diplomarbeit)

| Ziel | Anforderung | Erreicht | Status |
|------|-------------|----------|--------|
| Z2 - Transkription | > 80% Genauigkeit | ~95% | ✅ |
| Z3 - Dokumentation | 60% Verständlich | ~90% | ✅ |
| Z5 - Benutzerfreundlichkeit | 70% Intuitive Bedienung | ~85% | ✅ |

### Auto-Mode Verbesserungen

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|--------------|
| False Positives | ~40% | <5% | **-87%** 🎯 |
| API-Calls | 100% | 20% | **-80%** 💰 |
| Qualitätskontrolle | ❌ | ✅ 6 Kriterien | **100%** ✨ |
| Timing | Statisch 3s | Adaptiv 3-15s | **Intelligent** 🧠 |

## 🧪 Testing

```bash
# Unit Tests
npm test

# Integration Tests
npm run test:integration

# Extension testen
npm run test:extension
# Oder: F5 in VS Code
```

## 📝 Entwicklung

### Build Commands

```bash
# Entwicklung mit Auto-Reload
npm run watch

# Produktion Build
npm run compile

# Package Extension
npm run package
```

### Code-Struktur

- Folgt SOLID-Prinzipien
- Factory Pattern für STT-Provider
- Strategy Pattern für Placement
- Observer Pattern für Learning
- Singleton für Config Management

## 🤝 Contributing

Dieses Projekt ist Teil einer Diplomarbeit. Contributions sind nach Abschluss willkommen!

### Development Guidelines

1. Fork das Repository
2. Erstelle Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit Changes (`git commit -m 'Add AmazingFeature'`)
4. Push zu Branch (`git push origin feature/AmazingFeature`)
5. Öffne Pull Request

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) für Details.

## 👨‍🎓 Autor

**Azad Ahmed**  
TEKO Swiss Technical School - Diplomarbeit 2025

## 🙏 Danksagungen

- **TEKO Swiss Technical School** - Akademische Betreuung
- **EDA (Eidgenössisches Departement für Auswärtige Angelegenheiten)** - Projekt-Auftraggeber
- **OpenAI** - GPT-4 & Whisper API
- **VS Code Team** - Hervorragende Extension API

## 📚 Weitere Dokumentation

- [Installation Guide](INSTALLATION.md)
- [User Guide](USER_GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [Auto-Mode Documentation](src/automode/improved/README.md)
- [API Documentation](docs/API.md)

## 🔗 Links

- GitHub: [vscode-voice-doc-plugin](https://github.com/azad-ahmed/vscode-voice-doc-plugin)
- Issues: [Bug Reports](https://github.com/azad-ahmed/vscode-voice-doc-plugin/issues)
- Diplomarbeit: [Vollständige Thesis](docs/Diplomarbeit.pdf)

---

**Status:** ✅ Produktion-Ready | **Version:** 1.1.0 | **Letzte Aktualisierung:** November 2025
