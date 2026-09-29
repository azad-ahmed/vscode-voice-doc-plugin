# Hinweise für Claude

## Prüfbefehle

- `npm run compile` kompiliert die Extension mit `tsc`.
- `npm run lint` prüft `src` mit ESLint 9 (`eslint.config.mjs`). Fehler lassen den Befehl scheitern, Warnungen nicht. Rund 470 Warnungen stammen aus dem bestehenden Code; neue Änderungen sollen keine weiteren hinzufügen.
- `npm run test:unit` kompiliert die Tests und startet die Mocha-Unit-Tests in `test/unit` ohne VS Code. `test/unit/vscodeStub.ts` ersetzt dabei das Modul `vscode`.
- `npm test` startet die VS-Code-Integrationstests über `@vscode/test-electron` und lädt dafür VS Code herunter.

Als Nachweis für Änderungen dienen `compile`, `lint` und `test:unit`.

## Zweitmeinung von Codex

Nach Änderungen, die mehrere Dateien betreffen oder gespeicherte Daten, Nebenläufigkeit, Fehlerbehandlung, Sicherheit oder `contributes` in `package.json` berühren, lässt du die Codex-CLI den Diff prüfen, bevor du committest. Bei kleinen Fixes, Doku- und Textänderungen entfällt das.

- Nicht committete Änderungen: `codex review --uncommitted < /dev/null`
- Änderungen gegenüber `main`: `codex review --base main < /dev/null`
- Einzelne Frage ohne Schreibrechte: `codex exec -s read-only "<Frage>" < /dev/null`

Auch ohne Auftrag fragst du Codex selbständig mit `codex exec -s read-only`, wenn du bei einer Design- oder Architekturentscheidung unsicher bist, zwei Lösungswege gleichwertig erscheinen oder du nach zwei Versuchen bei einem Fehler nicht weiterkommst. Nenn dem Nutzer kurz, dass du Codex gefragt hast und was er geantwortet hat.

`< /dev/null` ist nötig, sonst wartet Codex auf Eingaben und hängt. Setz ein Timeout von 10 Minuten. Prüf jeden Befund selbst am Code, bevor du ihn umsetzt, und sag dem Nutzer, welche du übernommen oder verworfen hast und warum.

Fehlt die Codex-CLI oder ist sie nicht angemeldet (`codex login status`), arbeite ohne Zweitmeinung und sag das kurz.
