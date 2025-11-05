# Installationsanleitung - VS Code Voice Documentation Plugin

## Systemvoraussetzungen

### Minimale Anforderungen

- **Betriebssystem**: Windows 10/11, macOS 10.15+, oder Linux (Ubuntu 18.04+)
- **Visual Studio Code**: Version 1.60.0 oder höher
- **Node.js**: Version 14.x oder höher
- **npm**: Version 6.x oder höher
- **RAM**: Mindestens 4 GB
- **Festplattenspeicher**: Mindestens 500 MB freier Speicher
- **Mikrofon**: Internes oder externes Mikrofon erforderlich

### Empfohlene Anforderungen

- **Visual Studio Code**: Neueste Version
- **Node.js**: Version 16.x oder höher
- **RAM**: 8 GB oder mehr
- **Mikrofon**: Externes USB-Mikrofon für bessere Audioqualität
- **Internet-Verbindung**: Stabile Verbindung für API-Anfragen

## Installation

### Für Entwicklung

Das Projekt ist bereits auf Ihrem System installiert!

**Projektverzeichnis**: `C:\Users\azad\Documents\diplomarbeit\vscode-voice-doc-plugin`

#### Schritt 1: Dependencies prüfen

```bash
# Im Projektverzeichnis
npm install
```

#### Schritt 2: Kompilieren

```bash
npm run compile
```

#### Schritt 3: In VS Code laden

**Option A: Entwicklungsmodus (empfohlen)**

1. Öffnen Sie das Projekt in VS Code
2. Drücken Sie `F5`
3. Eine neue VS Code-Instanz mit dem Plugin öffnet sich

**Option B: Als Extension installieren**

1. VSIX-Paket erstellen:
   ```bash
   npm install -g vsce
   vsce package
   ```

2. In VS Code installieren:
   - Extensions-Ansicht öffnen (`Strg+Shift+X`)
   - Auf die drei Punkte (`...`) klicken
   - "Install from VSIX..." wählen
   - Die `.vsix`-Datei auswählen

## Konfiguration

### API-Schlüssel einrichten

Das Plugin benötigt einen API-Schlüssel für Speech-to-Text.

#### Option 1: OpenAI Whisper (Empfohlen)

1. VS Code öffnen
2. `Strg+Shift+P` drücken
3. "Voice Doc: OpenAI konfigurieren" wählen
4. API-Schlüssel eingeben

**API-Schlüssel erhalten:**
- Besuchen Sie https://platform.openai.com/
- Erstellen Sie ein Konto
- Navigieren Sie zu API Keys
- Erstellen Sie einen neuen Schlüssel

#### Option 2: Azure Speech-to-Text

1. VS Code öffnen
2. `Strg+Shift+P` drücken
3. "Voice Doc: Azure konfigurieren" wählen
4. API-Schlüssel und Region eingeben

#### Option 3: Demo-Modus (Ohne API-Schlüssel)

1. VS Code öffnen
2. `Strg+Shift+P` drücken
3. "Voice Doc: Demo-Modus aktivieren" wählen
4. Verwendet simulierte Transkriptionen

### Mikrofon-Berechtigungen

**Windows:**
1. Einstellungen → Datenschutz → Mikrofon
2. "Apps den Zugriff auf das Mikrofon erlauben" aktivieren
3. Zugriff für VS Code aktivieren

**macOS:**
1. Systemeinstellungen → Sicherheit & Datenschutz → Mikrofon
2. Kontrollkästchen für VS Code aktivieren

**Linux:**
```bash
# Mikrofon-Berechtigungen überprüfen
pactl list sources
```

### Einstellungen anpassen

Öffnen Sie VS Code-Einstellungen (`Strg+,`) und suchen Sie nach "Voice Doc Plugin":

```json
{
    "voiceDocPlugin.language": "de-DE",
    "voiceDocPlugin.commentStyle": "jsdoc",
    "voiceDocPlugin.autoSave": true,
    "voiceDocPlugin.showPreview": true
}
```

**Verfügbare Optionen:**

- `language`: Sprache für Spracherkennung (de-DE, en-US, etc.)
- `commentStyle`: Stil der Kommentare (jsdoc, inline, block)
- `autoSave`: Automatisches Speichern nach Erstellung
- `showPreview`: Vorschau vor dem Einfügen anzeigen

## Überprüfung der Installation

### Test 1: Plugin ist geladen

1. VS Code öffnen
2. `Strg+Shift+P` drücken
3. "Voice Doc" eingeben
4. Plugin-Befehle sollten sichtbar sein

### Test 2: Mikrofon funktioniert

1. Eine Code-Datei öffnen
2. Mikrofon-Symbol in der Statusleiste klicken
3. Einen Testsatz sprechen
4. Aufnahme sollte angezeigt werden

### Test 3: Dokumentation erstellen

1. JavaScript/TypeScript-Datei öffnen
2. Einfache Funktion schreiben:
   ```javascript
   function add(a, b) {
       return a + b;
   }
   ```
3. Cursor über der Funktion positionieren
4. `Strg+Shift+R` drücken
5. "Diese Funktion addiert zwei Zahlen" sagen
6. `Strg+Shift+R` zum Stoppen
7. Kommentar sollte eingefügt werden

## Fehlerbehebung

### Problem: Plugin wird nicht geladen

```bash
# Cache leeren und neu installieren
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### Problem: Mikrofon wird nicht erkannt

1. Systemberechtigungen überprüfen
2. Mikrofon in anderer Anwendung testen
3. VS Code neu starten

### Problem: Kompilierungsfehler

```bash
# Dependencies neu installieren
npm install
npm run compile
```

Falls der TypeScript-Fehler auftritt, siehe: **TYPESCRIPT_FIX.md**

### Problem: API-Fehler

1. API-Schlüssel überprüfen
2. Internet-Verbindung prüfen
3. API-Guthaben/Quota überprüfen
4. Output-Fenster für Details öffnen

## Deinstallation

### Über VS Code

1. Extensions-Ansicht öffnen (`Strg+Shift+X`)
2. "Voice Documentation Plugin" suchen
3. "Uninstall" klicken
4. VS Code neu starten

## Aktualisierung

### Aus dem Source Code

```bash
# Neueste Änderungen holen
git pull origin main

# Dependencies aktualisieren
npm install

# Neu kompilieren
npm run compile
```

## Nächste Schritte

Nach erfolgreicher Installation:

1. Siehe **SCHNELLSTART.md** für Schnelleinstieg
2. Siehe **USER_GUIDE.md** für ausführliche Anleitung
3. Siehe **CONTRIBUTING.md** für Entwicklung

## Support

Bei Problemen:

1. Siehe **FEHLERBEHEBUNG_ABGESCHLOSSEN.md**
2. Siehe **TYPESCRIPT_FIX.md** für TypeScript-Probleme
3. GitHub Issues erstellen

---

**Viel Erfolg mit dem Plugin!** 🚀
