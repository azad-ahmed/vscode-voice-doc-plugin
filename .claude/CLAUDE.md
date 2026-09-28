# Hinweise für Claude

## Prüfbefehle

- `npm run compile` kompiliert die Extension mit `tsc`.
- `npm run lint` prüft `src` mit ESLint 9 (`eslint.config.mjs`). Fehler lassen den Befehl scheitern, Warnungen nicht. Rund 470 Warnungen stammen aus dem bestehenden Code; neue Änderungen sollen keine weiteren hinzufügen.
- `npm run test:unit` kompiliert die Tests und startet die Mocha-Unit-Tests in `test/unit` ohne VS Code. `test/unit/vscodeStub.ts` ersetzt dabei das Modul `vscode`.
- `npm test` startet die VS-Code-Integrationstests über `@vscode/test-electron` und lädt dafür VS Code herunter.

Als Nachweis für Änderungen dienen `compile`, `lint` und `test:unit`.

## Claudex Loop

Für größere oder riskante Umsetzungen nutzt dieses Repo den Claudex Loop (Plugin `claudex-loop@claudex-loop`, eingetragen in `.claude/settings.json`).

- Starte den Skill `claudex-loop:claudex-loop` selbst, bevor du die erste Datei änderst, wenn eine Umsetzung mehrere Dateien betrifft oder gespeicherte Daten, Nebenläufigkeit, Fehlerbehandlung, Sicherheit oder die Befehle, Tastenkürzel, Menüs und Einstellungen der Extension (`contributes` in `package.json`) berührt. Sag dem Nutzer vorher in einem Satz, dass du ihn startest und warum, denn jeder Durchlauf verbraucht Codex-Kontingent.
- Nicht bei kleinen Fixes, Einzeilern, Doku- oder Textänderungen und Fragen.
- Für eine schnelle Zweitmeinung oder eine einzelne Übergabe an Codex reicht `claudex-loop:claudex-route`.
- Fehlt das Plugin oder die angemeldete Codex-CLI, arbeite ohne Loop und sag das kurz.
- `PLAN.md` und `PLAN-REVIEW-LOG.md` stehen in `.gitignore`. Soll ein Plan ins Repo, füge ihn mit `git add -f` hinzu.
