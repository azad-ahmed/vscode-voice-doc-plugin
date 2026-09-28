---
name: codex-loop
description: Pflicht-Ablauf für größere oder riskante Umsetzungen in diesem Repo, bevor Code geschrieben wird. Claude plant, Codex prüft den Plan in Review-Runden, Claude baut, Codex prüft den Code gegen. Ersatz für den Claudex Loop auf Basis des offiziellen Codex-Plugins (openai/codex-plugin-cc).
when_to_use: Starte diesen Skill selbst, bevor du die erste Datei änderst, wenn eine Umsetzung mehrere Dateien betrifft oder gespeicherte Daten, Nebenläufigkeit, Fehlerbehandlung, Sicherheit, Konfigurationsformate oder öffentliche Schnittstellen berührt. Außerdem, wenn der Nutzer Codex prüfen lassen will oder „claudex“ oder „codex-loop“ sagt. Nicht für kleine Fixes, Einzeiler, reine Doku- oder Textänderungen, Fragen und Erklärungen, und nicht, wenn der Subagent codex:codex-rescue fehlt, etwa in Cloud-Sessions.
argument-hint: "<Auftrag> [modus=voll|review] [runden=5] [plan=PLAN.md] [log=PLAN-REVIEW-LOG.md] [pruefen=an|aus]"
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git rev-parse *) Bash(git hash-object *)
---

# Codex-Loop

Grundsatz: Wer baut, bewertet seine Arbeit nicht selbst. Du (Claude) klärst die Anforderungen, schreibst den Plan und baust. Codex prüft den Plan und am Ende den Code.

Argumente: $ARGUMENTS

Lies Optionen im Format `schlüssel=wert` aus den Argumenten, der Rest ist der Auftrag. Nenne vor dem Start Modus, Plan- und Log-Datei und das Rundenlimit.

Hast du den Loop selbst gestartet, ist der Auftrag die aktuelle Aufgabe aus dem Gespräch. Sag dem Nutzer in einem Satz, dass du den Loop startest und warum. Gebaut wird nur, wenn der Nutzer eine Umsetzung verlangt hat, sonst nimmst du `modus=review`.

| Option | Standard | Bedeutung |
|---|---|---|
| `modus` | `voll` | `voll`: planen, prüfen lassen, bauen, gegenprüfen lassen. `review`: nur einen vorhandenen Plan prüfen lassen, nichts bauen |
| `runden` | `5` | Höchstzahl der Review-Runden für den Plan |
| `plan` | `PLAN.md` | Plan-Datei |
| `log` | `PLAN-REVIEW-LOG.md` | Protokoll, an das nur angehängt wird |
| `pruefen` | `an` | `aus` überspringt die Gegenprüfung des Codes und wird im Log vermerkt |

## Codex aufrufen

Codex erreichst du nur über den Subagenten `codex:codex-rescue` aus dem Codex-Plugin:

- Starte ihn mit dem `Agent`-Tool (`subagent_type: "codex:codex-rescue"`) im Vordergrund, denn du brauchst das Ergebnis.
- Die erste Zeile des Prompts ist `--wait --fresh` (neuer Codex-Thread) oder `--wait --resume` (letzten Codex-Thread fortsetzen).
- Die zweite Zeile lautet immer: `Read-only review. Do not add --write. Do not modify any files. Run the task in the foreground with a Bash timeout of 600000 ms and forward the text below verbatim.` Ohne diese Zeile startet der Subagent Codex mit Schreibrechten.
- Danach folgt der Auftrag an Codex aus den Vorlagen unten, jeweils mit dem Antwortformat.

Fehlt der Subagent oder meldet er, dass Codex nicht installiert oder nicht angemeldet ist, brichst du ab und verweist auf `/plugin install codex@openai-codex` und `/codex:setup`. Die Prüfung übernimmst du nie selbst.

Eine leere Antwort, ein abgebrochener oder in den Hintergrund verschobener Lauf oder eine Antwort ohne `VERDICT:` ist kein Urteil und niemals eine Freigabe. Frag dann einmal mit `--wait --resume` nach dem vollständigen Ergebnis im Antwortformat. Scheitert auch das, behandelst du die Runde wie BLOCKED und nennst dem Nutzer `/codex:status` und `/codex:result`.

Melde dem Nutzer nach jedem Codex-Aufruf in einer Zeile: Phase, Runde, Urteil, Zahl der Findings.

### Antwortformat

Übernimm diesen Block wörtlich in jeden Auftrag an Codex:

```text
Antworte auf Deutsch und exakt in diesem Format:
VERDICT: APPROVED | REVISE | BLOCKED
SUMMARY: <ein Satz>
FINDINGS:
- F1 [high|medium|low] <Datei:Zeile oder Planabschnitt>: <Problem>. Beleg: <Stelle, Befehl oder Zitat>. Fix: <konkreter Vorschlag>
COVERAGE: <was du tatsächlich gelesen oder geprüft hast>
LIMITS: <was du nicht prüfen konntest>
Regeln: APPROVED nur ohne offene high- oder medium-Findings. REVISE nur mit mindestens einem konkreten Finding. BLOCKED, wenn dir Informationen fehlen, mit Begründung unter LIMITS. Jedes Finding braucht einen Beleg. Keine Stil- oder Geschmacksfragen.
```

## Phase 1: Erkunden und planen

Nur bei `modus=voll`.

1. Lies den betroffenen Code: Aufrufer, gemeinsamer Zustand, Tests, Konfiguration. Zeig dem Nutzer deine wichtigsten Annahmen mit Quelle (Datei:Zeile).
2. Frag gesammelt nur nach Entscheidungen, die das Ergebnis ändern, jeweils mit deiner Empfehlung. Was der Code beantworten kann, schlägst du nach.
3. Schreib `plan` mit: Ziel und prüfbaren Akzeptanzkriterien; Vorgehen, Entscheidungen und Nicht-Zielen; Risiken und offenen Annahmen; Prüfbefehlen mit erwartetem Ergebnis (in diesem Repo zum Beispiel `npm run compile`, `npm run lint`, `npm run test:unit`).
4. Leg `log` an mit Datum, Auftrag, Modus und Rundenlimit.

Bei `modus=review` lädst du den vorhandenen Plan, legst `log` an, falls es fehlt, und gehst direkt zu Phase 2.

## Phase 2: Plan-Review durch Codex

Runde 1 mit `--wait --fresh`:

```text
Du bist ein unabhängiger, kritischer Reviewer. Claude hat den Implementierungsplan `<plan>` geschrieben. Prüfe ihn gegen den tatsächlichen Code in diesem Repository und lies die betroffenen Dateien selbst. Suche nach falschen Annahmen über den Code, fehlenden Fällen (Fehlerpfade, leere Eingaben, Nebenläufigkeit, Kompatibilität), Lücken im Vorgehen, nicht prüfbaren Akzeptanzkriterien und Risiken.
<Antwortformat>
```

Ab Runde 2 mit `--wait --resume`:

```text
Claude hat `<plan>` überarbeitet. Die Entscheidungen zu deinen Findings stehen in `<log>` unter „Runde <n>: Entscheidungen“. Prüfe den aktuellen Plan erneut. Bring abgelehnte Punkte nur mit neuem Beleg wieder ein.
<Antwortformat>
```

Häng nach jeder Runde die vollständige Codex-Antwort unter „Runde <n>: Codex“ an `log` an. Dann:

- **APPROVED:** Notiere den Hash des Plans (`git hash-object <plan>`) als Freigabe im Log. Die Freigabe gilt nur für genau diesen Stand. Bei `modus=review` endet der Loop hier.
- **REVISE:** Entscheide über jedes Finding: übernehmen und den Plan anpassen oder mit Begründung ablehnen. Schreib die Entscheidungen unter „Runde <n>: Entscheidungen“ ins Log und starte die nächste Runde.
- **BLOCKED:** Erklär dem Nutzer, was fehlt, und warte auf seine Entscheidung. Wiederhole die Runde nicht blind.

Nach `runden` Runden ohne APPROVED hörst du auf. Zeig dem Nutzer die offenen Findings und deine Sicht darauf. Gebaut wird dann nur, wenn der Nutzer das ausdrücklich will. Vermerke das im Log als „ohne Freigabe gebaut“.

## Phase 3: Bauen

Nur bei `modus=voll`.

1. Vergleiche `git hash-object <plan>` mit dem freigegebenen Hash. Hat sich der Plan seitdem geändert, geht er zurück in Phase 2 (`--wait --resume`).
2. Notiere den Ausgangs-Commit (`git rev-parse HEAD`) und schon vorhandene Änderungen (`git status --short`) im Log. Fremde Änderungen fasst du nicht an.
3. Setz den Plan um. Jede Abweichung vom Plan notierst du mit Grund im Log.
4. Führ die Prüfbefehle aus dem Plan selbst aus und notiere die Ergebnisse.

## Phase 4: Gegenprüfung durch Codex

Nur bei `modus=voll` und `pruefen=an`. Immer mit `--wait --fresh`, nie im Thread des Plan-Reviews:

```text
Du bist ein unabhängiger, kritischer Reviewer. Claude hat `<plan>` umgesetzt, Ausgangs-Commit `<sha>`. Prüfe alle Änderungen seitdem: `git diff <sha>` und neue, nicht versionierte Dateien, außer `<plan>` und `<log>`. Miss sie an den Akzeptanzkriterien im Plan. Suche nach Fehlern, fehlenden Fällen, Abweichungen vom Plan und Tests, die nur die Implementierung bestätigen statt die Anforderung.
<Antwortformat>
```

Häng die Antwort unter „Gegenprüfung <n>: Codex“ ans Log an. Bei REVISE behebst du die übernommenen high- und medium-Findings, führst die Prüfbefehle erneut aus und lässt mit `--wait --fresh` neu prüfen. Nenne Codex dabei die behobenen Findings. Höchstens 2 Nachbesserungsrunden, was danach offen ist, meldest du dem Nutzer.

Der Nutzer hat diesen Loop eingerichtet, damit Findings eingearbeitet werden: im Plan (Phase 2) und im Code, soweit der Plan sie abdeckt (Phase 4). Die allgemeine Regel des Plugins, nach einem Review erst nachzufragen, gilt hier deshalb nicht. Änderungen über den Plan hinaus brauchen weiterhin die Zustimmung des Nutzers.

## Abschluss

Fasse zusammen: Plan-Runden und Urteil, geänderte Dateien, Ergebnisse der Prüfbefehle, Ergebnis der Gegenprüfung, offene Findings und Abweichungen. Commit und Push nur, wenn der Nutzer das beauftragt hat.
