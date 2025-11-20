# ✅ Git-Ready Checkliste

## Vor dem Push

### 1. Projekt-Bereinigung ✅

- [ ] **Cleanup-Script ausführen**
  ```powershell
  .\cleanup.ps1
  ```

- [ ] **Backup-Dateien entfernt**
  - [ ] `projectMonitor.BACKUP.ts`
  - [ ] `projectMonitor.IMPROVED.ts`
  - [ ] `projectMonitor.ts.backup`
  - [ ] `extension_UPDATED.ts`
  - [ ] `intelligentPlacer.ts.backup`

- [ ] **Redundante Ordner entfernt**
  - [ ] `backup-deleted-code/`
  - [ ] `redundant/`
  - [ ] `documented-versions/`
  - [ ] `temp/`

### 2. Kompilierung ✅

- [ ] **TypeScript kompiliert ohne Fehler**
  ```powershell
  npm run compile
  ```
  
- [ ] **Keine Warnungen** (oder nur akzeptable)

- [ ] **Extension lädt** (F5 Test)

### 3. Dokumentation ✅

- [ ] **README.md** vorhanden und aktuell
- [ ] **CHANGELOG.md** dokumentiert Änderungen
- [ ] **.gitignore** schützt sensitive Dateien
- [ ] **API-Keys** NICHT im Repository

### 4. Code-Qualität ✅

- [ ] **Keine TODO/FIXME** im Production-Code
- [ ] **Keine console.log** außer in Debug-Code
- [ ] **Imports aufgeräumt**
- [ ] **Unused Code entfernt**

### 5. Git-Status ✅

- [ ] **Git initialisiert**
  ```bash
  git init  # Falls noch nicht vorhanden
  ```

- [ ] **Remote konfiguriert**
  ```bash
  git remote add origin https://github.com/azad-ahmed/vscode-voice-doc-plugin.git
  ```

- [ ] **Branch korrekt**
  ```bash
  git branch -M main
  ```

## Push-Prozess

### Automatisch (Empfohlen)

```powershell
# Führt Cleanup + Compile + Push durch
.\git-push.ps1 -CommitMessage "Beschreibung der Änderungen"
```

### Manuell

```bash
# 1. Cleanup
.\cleanup.ps1

# 2. Status prüfen
git status

# 3. Alle Änderungen stagen
git add .

# 4. Commit erstellen
git commit -m "Projekt bereinigt und Auto-Mode verbessert"

# 5. Push zu GitHub
git push -u origin main
```

## Nach dem Push

### Verifikation

- [ ] **GitHub Repository prüfen**
  - Alle Dateien vorhanden?
  - README wird korrekt angezeigt?
  - Keine sensitive Daten sichtbar?

- [ ] **Clone testen**
  ```bash
  # In neuem Ordner
  git clone https://github.com/azad-ahmed/vscode-voice-doc-plugin.git test
  cd test
  npm install
  npm run compile
  ```

- [ ] **Extension funktioniert**
  - F5 → Extension Host startet
  - Commands verfügbar
  - Auto-Mode funktioniert

### Diplomarbeit

- [ ] **Screenshot von GitHub** für Dokumentation
- [ ] **Commit-History** dokumentiert
- [ ] **README** zeigt Professional aussehen
- [ ] **CHANGELOG** zeigt Entwicklung

## Probleme?

### Kompilierungs-Fehler

```powershell
# Nodes modules löschen und neu installieren
Remove-Item node_modules -Recurse -Force
npm install
npm run compile
```

### Git-Probleme

```bash
# Remote neu setzen
git remote remove origin
git remote add origin https://github.com/azad-ahmed/vscode-voice-doc-plugin.git

# Branch neu erstellen
git branch -M main
git push -u origin main --force
```

### Große Dateien

```bash
# Finde große Dateien
git ls-files -s | awk '{print $4 " " $2}' | sort -rn | head -20

# Entferne aus Git (aber behalte lokal)
git rm --cached <datei>
echo "<datei>" >> .gitignore
```

## Finale Checks vor Diplomarbeit-Abgabe

- [ ] **Repository ist öffentlich** (oder für Dozenten freigegeben)
- [ ] **README ist professionell**
- [ ] **Code ist dokumentiert**
- [ ] **CHANGELOG zeigt Entwicklung**
- [ ] **Keine Secrets im Repository**
- [ ] **Extension funktioniert Demo-fähig**

## Git-Befehle Quick-Reference

```bash
# Status
git status

# Änderungen sehen
git diff

# Letzte Commits
git log --oneline -10

# Undo letzten Commit (behält Änderungen)
git reset --soft HEAD~1

# Branch wechseln
git checkout -b feature/new-feature

# Tag erstellen (für Release)
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

---

## ✅ Bereit für Push wenn:

1. ✅ Alle Checkboxen oben abgehakt
2. ✅ `npm run compile` erfolgreich
3. ✅ Extension getestet (F5)
4. ✅ Keine sensiblen Daten im Code
5. ✅ README und CHANGELOG aktuell

## 🚀 Dann:

```powershell
.\git-push.ps1
```

**Viel Erfolg mit der Diplomarbeit! 🎓**
