# 🎤 VS Code Voice Documentation Plugin

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/azad-ahmed/vscode-voice-doc-plugin)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> KI-gestützte Code-Dokumentation per Spracheingabe - Diplomarbeit Projekt

Ein innovatives VS Code Plugin, das Entwicklern ermöglicht, Code-Dokumentation durch Spracheingabe zu erstellen. Das Plugin nutzt moderne KI-Technologien (OpenAI Whisper, GPT-4, Azure Cognitive Services) für Speech-to-Text und intelligente Kommentargenerierung.

## 📋 Inhaltsverzeichnis

- [Features](#-features)
- [Installation](#-installation)
- [Erste Schritte](#-erste-schritte)
- [Konfiguration](#-konfiguration)
- [Verwendung](#-verwendung)
- [Architektur](#-architektur)
- [Entwicklung](#-entwicklung)
- [Lizenz](#-lizenz)

## ✨ Features

### 🎙️ Voice-to-Comment
- **Sprachaufnahme**: Drücken Sie `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`) um die Aufnahme zu starten/stoppen
- **Multi-Provider Support**: OpenAI Whisper oder Azure Speech Services
- **Automatische Transkription**: Sprache wird in Text umgewandelt
- **KI-Verbesserung**: GPT-4 optimiert die Dokumentation (optional)

### 🤖 Auto-Modus
- **Automatische Code-Analyse**: Erkennt undokumentierte Funktionen und Klassen
- **Intelligente Vorschläge**: KI generiert passende Kommentare basierend auf Code-Kontext
- **Lern-System**: Plugin lernt aus Ihrem Feedback und passt sich an

### 📊 Code-Analyse
- **Komplexitäts-Messung**: Bewertet Code-Komplexität (McCabe)
- **Pattern-Erkennung**: Identifiziert Code-Patterns aus vergangenen Dokumentationen
- **Multi-Language Support**: TypeScript, JavaScript, Python

### 🎨 Flexible Kommentar-Stile
- JSDoc (Standard)
- Inline-Kommentare
- Block-Kommentare

## 🚀 Installation

### Voraussetzungen
- Visual Studio Code 1.70.0 oder höher
- Node.js 16.x oder höher
- OpenAI API Key oder Azure Cognitive Services Key

### Aus Source installieren

```bash
# Repository klonen
git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
cd vscode-voice-doc-plugin

# Abhängigkeiten installieren
npm install

# Projekt kompilieren
npm run compile

# Extension in VS Code laden
# Drücke F5 um Extension Development Host zu starten
```

## 🎯 Erste Schritte

### 1. API Keys konfigurieren

**Option A: OpenAI (Empfohlen)**
```
Ctrl+Shift+P → "Voice Doc: OpenAI API Key konfigurieren"
```

**Option B: Azure Cognitive Services**
```
Ctrl+Shift+P → "Voice Doc: Azure konfigurieren"
```

### 2. Erste Sprachaufnahme

1. Öffnen Sie eine Code-Datei
2. Positionieren Sie den Cursor über einer Funktion/Klasse
3. Drücken Sie `Ctrl+Shift+R`
4. Sprechen Sie Ihre Dokumentation
5. Drücken Sie erneut `Ctrl+Shift+R` zum Stoppen
6. Der Kommentar wird automatisch eingefügt

### 3. Auto-Modus aktivieren

```
Ctrl+Shift+P → "Voice Doc: Auto-Modus umschalten"
```

## ⚙️ Konfiguration

Öffnen Sie die VS Code Einstellungen (`Ctrl+,`) und suchen Sie nach "Voice Doc":

| Einstellung | Beschreibung | Standard |
|------------|-------------|----------|
| `voiceDocPlugin.sttProvider` | Speech-to-Text Provider | `auto` |
| `voiceDocPlugin.language` | Sprache für Erkennung | `de-DE` |
| `voiceDocPlugin.autoMode` | Auto-Analyse aktivieren | `false` |
| `voiceDocPlugin.minConfidence` | Min. Konfidenz für Vorschläge | `0.7` |
| `voiceDocPlugin.learningEnabled` | Lern-System aktivieren | `true` |
| `voiceDocPlugin.commentStyle` | Kommentar-Stil | `JSDoc` |

Beispiel `settings.json`:
```json
{
  "voiceDocPlugin.sttProvider": "openai",
  "voiceDocPlugin.language": "de-DE",
  "voiceDocPlugin.autoMode": true,
  "voiceDocPlugin.commentStyle": "JSDoc"
}
```

## 📖 Verwendung

### Kommandos

| Kommando | Tastenkombination | Beschreibung |
|---------|------------------|--------------|
| Toggle Recording | `Ctrl+Shift+R` | Aufnahme starten/stoppen |
| Convert to Comment | `Ctrl+Shift+C` | Markierten Text in Kommentar umwandeln |
| Toggle Auto Mode | `Ctrl+Shift+A` | Auto-Modus ein/aus |
| Analyze Function | - | Aktuelle Funktion analysieren |
| Show Statistics | - | Lern-Statistiken anzeigen |

### Beispiel-Workflow

```typescript
// 1. Schreiben Sie eine Funktion
function calculateTotal(items: Item[], taxRate: number): number {
    return items.reduce((sum, item) => sum + item.price, 0) * (1 + taxRate);
}

// 2. Cursor über Funktion positionieren, Ctrl+Shift+R drücken

// 3. Sprechen: "Diese Funktion berechnet den Gesamtpreis inklusive Steuer"

// 4. Ergebnis nach Enter:
/**
 * Berechnet den Gesamtpreis aller Items inklusive Steuern
 * @param items - Array von Items mit Preisen
 * @param taxRate - Steuersatz als Dezimalzahl (z.B. 0.19 für 19%)
 * @returns Gesamtpreis inklusive Steuern
 */
function calculateTotal(items: Item[], taxRate: number): number {
    return items.reduce((sum, item) => sum + item.price, 0) * (1 + taxRate);
}
```

## 🏗️ Architektur

```
vscode-voice-doc-plugin/
├── src/
│   ├── extension.ts              # Extension Entry Point
│   ├── generator.ts              # Kommentar-Generator
│   ├── integratedVoiceHandler.ts # Voice Input Handler
│   ├── analysis/
│   │   ├── codeAnalyzer.ts       # Code-Analyse mit GPT-4
│   │   └── autoCommentator.ts    # Automatische Kommentierung
│   ├── audio/
│   │   └── audioRecorder.ts      # Audio-Aufnahme
│   ├── stt/
│   │   ├── openAIProvider.ts     # OpenAI Whisper Integration
│   │   ├── azureProvider.ts      # Azure STT Integration
│   │   └── sttService.ts         # STT Service Manager
│   ├── learning/
│   │   └── learningSystem.ts     # ML-basiertes Lernsystem
│   └── utils/
│       ├── errorHandler.ts       # Fehlerbehandlung
│       ├── configManager.ts      # Konfigurations-Manager
│       └── apiUsageTracker.ts    # API-Nutzungs-Tracking
├── test/                         # Unit & Integration Tests
├── package.json
├── tsconfig.json
└── README.md
```

Mehr Details in [ARCHITECTURE.md](ARCHITECTURE.md)

## 🛠️ Entwicklung

### Setup

```bash
# Repository klonen
git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
cd vscode-voice-doc-plugin

# Dependencies installieren
npm install

# Projekt kompilieren
npm run compile

# Tests ausführen
npm test

# Linting
npm run lint
```

### Extension debuggen

1. Öffnen Sie das Projekt in VS Code
2. Drücken Sie `F5` um Extension Development Host zu starten
3. Breakpoints setzen und debuggen

### Neue Features hinzufügen

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Guidelines

## 📊 Projektinformationen

**Diplomarbeit**: KI-gestützte Code-Dokumentation durch Spracheingabe  
**Autor**: Azad Ahmed  
**Institution**: [Ihre Institution]  
**Betreuer**: [Name des Betreuers]  
**Jahr**: 2024/2025

### Projektziele

- ✅ **Z1**: Sprachaufnahme während des Programmierens
- ✅ **Z2**: Automatische Speech-to-Text Transkription (>80% Genauigkeit)
- ✅ **Z3**: KI-generierte strukturierte Dokumentation (>90% Verständlichkeit)
- ✅ **Z4**: Nahtlose VS Code Integration
- ✅ **Z5**: Intuitive Benutzeroberfläche (>70% Zufriedenheit)

## 🤝 Beitragen

Contributions sind willkommen! Siehe [CONTRIBUTING.md](CONTRIBUTING.md)

1. Fork das Repository
2. Erstelle einen Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 📝 Changelog

Siehe [CHANGELOG.md](CHANGELOG.md) für alle Änderungen

## 📄 Lizenz

Dieses Projekt ist unter der MIT Lizenz lizenziert - siehe [LICENSE](LICENSE) für Details

## 🙏 Danksagungen

- OpenAI für Whisper und GPT-4 API
- Microsoft für Azure Cognitive Services
- VS Code Extension API Team
- Alle Betreuer und Tester des Projekts

## 📧 Kontakt

Azad Ahmed - [@azad-ahmed](https://github.com/azad-ahmed)

Projekt Link: [https://github.com/azad-ahmed/vscode-voice-doc-plugin](https://github.com/azad-ahmed/vscode-voice-doc-plugin)

---

**Hinweis**: Dieses Plugin wurde im Rahmen einer Diplomarbeit entwickelt und befindet sich in aktiver Entwicklung.
