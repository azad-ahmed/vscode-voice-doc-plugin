# Hinweise für Claude

## Prüfbefehle

- `npm run compile` kompiliert die Extension mit `tsc`.
- `npm run lint` prüft `src` mit ESLint 9 (`eslint.config.mjs`). Fehler lassen den Befehl scheitern, Warnungen nicht. Rund 470 Warnungen stammen aus dem bestehenden Code; neue Änderungen sollen keine weiteren hinzufügen.
- `npm run test:unit` kompiliert die Tests und startet die Mocha-Unit-Tests in `test/unit` ohne VS Code. `test/unit/vscodeStub.ts` ersetzt dabei das Modul `vscode`.
- `npm test` startet die VS-Code-Integrationstests über `@vscode/test-electron` und lädt dafür VS Code herunter.

Als Nachweis für Änderungen dienen `compile`, `lint` und `test:unit`.
