# Benutzerhandbuch
## Voice Documentation Plugin für Visual Studio Code

> Ausführliche Anleitung für die Nutzung des Voice Documentation Plugins

---

## Inhaltsverzeichnis

1. [Erste Schritte](#erste-schritte)
2. [Grundlegende Nutzung](#grundlegende-nutzung)
3. [Erweiterte Funktionen](#erweiterte-funktionen)
4. [Tipps und Best Practices](#tipps-und-best-practices)
5. [Problemlösung](#problemlösung)
6. [FAQ](#faq)

---

## Erste Schritte

### Installation

Das Plugin kann auf drei Arten installiert werden:

#### Option 1: VS Code Marketplace (empfohlen)
1. Öffnen Sie VS Code
2. Gehen Sie zu Extensions (`Ctrl+Shift+X`)
3. Suchen Sie nach "Voice Documentation"
4. Klicken Sie auf "Installieren"

#### Option 2: VSIX-Datei
1. Laden Sie die `.vsix` Datei herunter
2. Öffnen Sie VS Code
3. Extensions → "..." → "Von VSIX installieren"
4. Wählen Sie die heruntergeladene Datei

#### Option 3: Aus Quellcode
```bash
git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
cd vscode-voice-doc-plugin
npm install
npm run compile
```

### Einrichtung

Nach der Installation müssen Sie einen Speech-to-Text Provider konfigurieren.

#### OpenAI Whisper einrichten (empfohlen)

**Schritt 1: API Key erhalten**
1. Besuchen Sie https://platform.openai.com
2. Erstellen Sie ein Konto oder melden Sie sich an
3. Navigieren Sie zu API Keys
4. Erstellen Sie einen neuen Key

**Schritt 2: In Extension konfigurieren**
1. Drücken Sie `Ctrl+Shift+P`
2. Geben Sie ein: "Voice Doc: OpenAI API Key konfigurieren"
3. Fügen Sie Ihren API Key ein
4. Drücken Sie Enter

✅ **Fertig!** Das Plugin ist einsatzbereit.

**Kosten**: ca. $0.006 pro Minute Audio (sehr günstig)

#### Azure Cognitive Services einrichten

**Schritt 1: Azure Speech Service erstellen**
1. Besuchen Sie https://portal.azure.com
2. Erstellen Sie eine "Speech Service" Ressource
3. Notieren Sie:
   - API Key (unter "Keys and Endpoint")
   - Region (z.B. "westeurope")

**Schritt 2: In Extension konfigurieren**
1. Drücken Sie `Ctrl+Shift+P`
2. Geben Sie ein: "Voice Doc: Azure konfigurieren"
3. Geben Sie API Key ein
4. Wählen Sie Ihre Region

✅ **Fertig!**

**Kosten**: Erste 5 Stunden/Monat kostenlos

#### Demo-Modus (ohne API Key)

Für Tests ohne API Key:
1. `Ctrl+Shift+P` → "Voice Doc: Demo-Modus aktivieren"
2. Plugin verwendet simulierte Transkriptionen

⚠️ **Hinweis**: Im Demo-Modus wird keine echte Sprache erkannt!

---

## Grundlegende Nutzung

### Ihre erste Sprachnotiz

**Schritt-für-Schritt Anleitung:**

1. **Datei öffnen**
   - Öffnen Sie eine beliebige Code-Datei
   - Positionieren Sie den Cursor dort, wo der Kommentar eingefügt werden soll

2. **Aufnahme starten**
   - Drücken Sie `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`)
   - Oder: Klicken Sie auf das Mikrofon-Icon in der Statusleiste
   - Sie sehen: "🎤 Aufnahme läuft..."

3. **Erklärung sprechen**
   ```
   Beispiel: "Diese Funktion validiert die Benutzereingabe 
             und prüft ob alle Pflichtfelder ausgefüllt sind"
   ```
   
   **Tipps**:
   - Sprechen Sie klar und deutlich
   - Vermeiden Sie Füllwörter (äh, ähm, also)
   - Maximale Dauer: 30 Sekunden

4. **Aufnahme stoppen**
   - Drücken Sie erneut `Ctrl+Shift+R`
   - Oder: Klicken Sie auf das Aufnahme-Icon

5. **Warten Sie auf Transkription**
   - Sie sehen: "⏹️ Aufnahme gestoppt. Transkribiere..."
   - Dies dauert 1-5 Sekunden

6. **Aktion wählen**
   
   Es erscheint ein Dialog mit dem erkannten Text:
   ```
   🎙️ Erkannter Text:
   
   "Diese Funktion validiert die Benutzereingabe und prüft 
    ob alle Pflichtfelder ausgefüllt sind"
   
   Was möchtest du tun?
   ```
   
   **Optionen**:
   - **Einfügen**: Text wird als Kommentar formatiert und eingefügt
   - **Mit KI verbessern**: OpenAI optimiert den Text (API Key erforderlich)
   - **Bearbeiten**: Sie können den Text manuell anpassen
   - **Abbrechen**: Vorgang abbrechen

7. **Ergebnis**
   
   Der Kommentar wird automatisch eingefügt:
   ```typescript
   /**
    * Validiert die Benutzereingabe und prüft, ob alle 
    * Pflichtfelder ausgefüllt sind.
    */
   function validateInput(data) {
       // ...
   }
   ```

**Fertig!** 🎉

### Sprachauswahl

Das Plugin unterstützt mehrere Sprachen:

**Sprache ändern:**
1. Öffnen Sie VS Code Settings (`Ctrl+,`)
2. Suchen Sie nach "Voice Doc"
3. Unter "Language" wählen Sie:
   - `de-DE` - Deutsch
   - `en-US` - Englisch (US)
   - `en-GB` - Englisch (UK)
   - `fr-FR` - Französisch
   - `es-ES` - Spanisch
   - `it-IT` - Italienisch
   - `pt-PT` - Portugiesisch

Oder in `settings.json`:
```json
{
  "voiceDocPlugin.language": "de-DE"
}
```

---

## Erweiterte Funktionen

### KI-Verbesserung von Kommentaren

Wenn Sie einen OpenAI API Key konfiguriert haben, können Sie Ihre Kommentare automatisch verbessern lassen.

**So funktioniert's:**

1. Nehmen Sie wie gewohnt eine Sprachnotiz auf
2. Wählen Sie **"Mit KI verbessern"**
3. GPT-3.5 optimiert den Text:
   - Verbessert Grammatik
   - Fügt Struktur hinzu
   - Behält technische Begriffe bei
   - Berücksichtigt Code-Kontext

**Beispiel:**

```
Eingabe (gesprochen):
"hier wird äh die liste sortiert also nach datum und dann filtered"

Nach KI-Verbesserung:
"Sortiert die Liste nach Datum und filtert anschließend die Ergebnisse"
```

### Text zu Kommentar konvertieren

Sie haben bereits Text im Editor? Konvertieren Sie ihn in einen Kommentar:

1. Markieren Sie den Text
2. Drücken Sie `Ctrl+Shift+C`
3. Text wird in Kommentar umgewandelt

**Beispiel:**
```
Markiert: "Berechnet die Summe aller Elemente"

Wird zu:
// Berechnet die Summe aller Elemente
```

### Kommentar aus Zwischenablage

1. Kopieren Sie Text in die Zwischenablage
2. `Ctrl+Shift+P` → "Voice Doc: Kommentar aus Zwischenablage"
3. Kommentar wird an Cursor-Position eingefügt

### API-Nutzung anzeigen

Überwachen Sie Ihre API-Kosten:

1. `Ctrl+Shift+P` → "Voice Doc: API-Nutzung anzeigen"

Sie sehen:
```
📊 Voice Doc API Nutzung (letzte 30 Tage)

Gesamt:
• Transkriptionen: 45
• Dauer: 23 Minuten
• Geschätzte Kosten: $0.14
• Fehler: 2

Durchschnitt pro Tag:
• 1.5 Transkriptionen
• $0.005 Kosten
```

### STT-Provider testen

Überprüfen Sie welche Provider verfügbar sind:

1. `Ctrl+Shift+P` → "Voice Doc: STT-Provider testen"

Ausgabe:
```
📊 Gefundene Provider: 2

✅ OpenAI Whisper: Verfügbar
❌ Azure Cognitive Services: Nicht konfiguriert
```

---

## Tipps und Best Practices

### Für beste Transkriptions-Ergebnisse

**Audio-Qualität:**
- 🎤 Verwenden Sie ein gutes Mikrofon (Headset empfohlen)
- 🔇 Minimieren Sie Hintergrundgeräusche
- 📍 Sprechen Sie direkt ins Mikrofon (5-10cm Abstand)

**Sprech-Stil:**
- ✅ Sprechen Sie klar und deutlich
- ✅ Normale Geschwindigkeit (nicht zu schnell)
- ✅ Verwenden Sie vollständige Sätze
- ❌ Vermeiden Sie Füllwörter (äh, ähm, also, ja)
- ❌ Vermeiden Sie Hintergrundgespräche

**Inhalt:**
- Beschreiben Sie **WAS** der Code macht, nicht **WIE**
- Erklären Sie **WARUM** Entscheidungen getroffen wurden
- Erwähnen Sie **Einschränkungen** oder **Besonderheiten**

**Beispiele:**

✅ **Gut:**
```
"Diese Funktion validiert Benutzereingaben und wirft eine 
 Exception bei ungültigen Daten. Die Validierung erfolgt 
 asynchron um die UI nicht zu blockieren."
```

❌ **Weniger gut:**
```
"Also äh hier haben wir eine Funktion die äh macht quasi 
 das checking und so"
```

### Arbeitsweise optimieren

**Workflow-Integration:**

1. **Während des Codierens**:
   - Schreiben Sie Code
   - Drücken Sie `Ctrl+Shift+R`
   - Erklären Sie was Sie gerade gemacht haben
   - Weiter coden

2. **Code Review**:
   - Gehen Sie durch undokumentierten Code
   - Fügen Sie Sprach-Kommentare hinzu
   - Bessere Dokumentation in kürzerer Zeit

3. **Legacy Code**:
   - Verstehen Sie eine Funktion
   - Dokumentieren Sie Ihr Verständnis per Sprache
   - Hilft auch anderen Teammitgliedern

### Kosten optimieren

**OpenAI Whisper** (~$0.006/Minute):
- Eine 10-Sekunden-Notiz kostet ca. $0.001
- 100 Kommentare (je 10s) = ~$0.10
- Sehr kostengünstig!

**Tipps zum Sparen:**
- Kurze, prägnante Erklärungen
- Nicht zu viele Wiederholungen
- Nutzen Sie "Einfügen" statt "Mit KI verbessern" wenn möglich

### Tastenkombinationen merken

| Aktion | Windows/Linux | Mac |
|--------|--------------|-----|
| Aufnahme Toggle | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Text zu Kommentar | `Ctrl+Shift+C` | `Cmd+Shift+C` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |

---

## Problemlösung

### Audio-Aufnahme funktioniert nicht

**Windows:**

Problem: "Keine Audio-Aufnahme-Software gefunden"

Lösung 1 - FFmpeg installieren:
1. Besuchen Sie https://ffmpeg.org/download.html
2. Laden Sie FFmpeg für Windows herunter
3. Extrahieren Sie die Dateien
4. Fügen Sie `bin/` Ordner zum PATH hinzu
5. Starten Sie VS Code neu

Lösung 2 - SoX installieren:
1. Besuchen Sie http://sox.sourceforge.net/
2. Laden Sie SoX für Windows herunter
3. Installieren Sie SoX
4. Starten Sie VS Code neu

**macOS:**

```bash
# FFmpeg installieren
brew install ffmpeg

# Oder SoX
brew install sox
```

**Linux (Ubuntu/Debian):**

```bash
# ALSA (empfohlen)
sudo apt-get install alsa-utils

# Oder PulseAudio
sudo apt-get install pulseaudio-utils

# Oder FFmpeg
sudo apt-get install ffmpeg
```

### Transkription liefert falsche Ergebnisse

**Mögliche Ursachen:**

1. **Schlechte Audio-Qualität**
   - Lösung: Besseres Mikrofon verwenden
   - Lösung: Hintergrundgeräusche reduzieren

2. **Falsche Sprache eingestellt**
   - Lösung: Prüfen Sie Settings → "voiceDocPlugin.language"

3. **Undeutliche Aussprache**
   - Lösung: Langsamer und deutlicher sprechen

4. **Technische Fachbegriffe**
   - Lösung: Nutzen Sie "Bearbeiten" um zu korrigieren

### API-Fehler

**"OpenAI API Key nicht konfiguriert"**
- Lösung: `Ctrl+Shift+P` → "Voice Doc: OpenAI API Key konfigurieren"

**"API Request failed: 401"**
- Lösung: API Key ist ungültig → Neuen Key generieren

**"API Request failed: 429"**
- Lösung: Rate Limit erreicht → Warten Sie ein paar Minuten

**"Connection timeout"**
- Lösung: Prüfen Sie Ihre Internetverbindung

### Extension lädt nicht

1. Prüfen Sie VS Code Output:
   - View → Output → "Voice Documentation"

2. Extension neu laden:
   - `Ctrl+Shift+P` → "Developer: Reload Window"

3. Extension neu installieren:
   - Deinstallieren
   - VS Code neustarten
   - Neu installieren

### Kommentare werden nicht eingefügt

**Mögliche Ursachen:**

1. **Kein aktiver Editor**
   - Lösung: Öffnen Sie eine Datei

2. **Nur-Lesen Modus**
   - Lösung: Datei-Rechte prüfen

3. **Extension-Konflikt**
   - Lösung: Andere Extensions temporär deaktivieren

---

## FAQ

### Allgemeine Fragen

**Q: Funktioniert das Plugin offline?**  
A: Nein, STT-Provider benötigen Internet. Demo-Modus funktioniert offline.

**Q: Werden meine Audio-Aufnahmen gespeichert?**  
A: Nein, Aufnahmen werden automatisch nach 1 Stunde gelöscht.

**Q: Ist das Plugin kostenlos?**  
A: Das Plugin selbst ist kostenlos. STT-Provider (OpenAI/Azure) kosten Geld, sind aber sehr günstig.

**Q: Welche Programmiersprachen werden unterstützt?**  
A: JavaScript, TypeScript, Python, Java, C/C++, PHP, Go, Rust, Ruby, SQL, HTML, CSS, Bash, PowerShell, YAML und mehr.

### Technische Fragen

**Q: Wie lange kann ich aufnehmen?**  
A: Maximal 30 Sekunden pro Aufnahme.

**Q: Kann ich die Aufnahmedauer ändern?**  
A: Aktuell nicht über Settings. Quellcode kann angepasst werden.

**Q: Wo werden API Keys gespeichert?**  
A: Sicher in VS Code SecretStorage (verschlüsselt).

**Q: Kann ich mehrere STT-Provider gleichzeitig nutzen?**  
A: Ja, das Plugin wählt automatisch den besten verfügbaren.

**Q: Unterstützt das Plugin Teamwork?**  
A: API-Keys sind benutzerspezifisch. Jedes Teammitglied benötigt eigene Keys.

### Datenschutz & Sicherheit

**Q: Werden meine Daten an Dritte weitergegeben?**  
A: Audio wird nur an gewählten STT-Provider gesendet (OpenAI/Azure). Keine anderen Drittanbieter.

**Q: Gibt es Telemetrie?**  
A: Nein, keinerlei Tracking oder Telemetrie.

**Q: Können andere meinen API Key sehen?**  
A: Nein, Keys sind verschlüsselt und benutzerspezifisch.

---

## Support

### Hilfe erhalten

**Dokumentation:**
- [README.md](README.md) - Übersicht
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technische Details
- [CONTRIBUTING.md](CONTRIBUTING.md) - Für Entwickler

**Community:**
- GitHub Issues: https://github.com/azad-ahmed/vscode-voice-doc-plugin/issues
- GitHub Discussions: Für Fragen und Diskussionen

**Bug melden:**
1. Überprüfen Sie bestehende Issues
2. Erstellen Sie neues Issue mit:
   - Beschreibung des Problems
   - Schritte zur Reproduktion
   - VS Code Version
   - Betriebssystem
   - Extension Version
   - Logs aus Output-Channel

---

## Zusätzliche Ressourcen

### Video-Tutorials

Coming soon!

### Blog-Posts

Coming soon!

### Externe Links

- [OpenAI Whisper Dokumentation](https://platform.openai.com/docs/guides/speech-to-text)
- [Azure Speech Services Dokumentation](https://docs.microsoft.com/azure/cognitive-services/speech-service/)
- [VS Code Extension API](https://code.visualstudio.com/api)

---

**Version:** 1.0.0  
**Letztes Update:** Oktober 2025  
**Autor:** Azad Ahmed

Viel Erfolg mit dem Voice Documentation Plugin! 🎤✨
