# 📊 Architektur-Diagramme für Diplomarbeit

## 1. System-Übersicht

```mermaid
graph TB
    A[Benutzer schreibt Code] --> B[VS Code Editor]
    B --> C[File System Watcher]
    C --> D[ImprovedProjectMonitor]
    D --> E[AdaptiveDebouncer]
    E --> F{Wartezeit abgelaufen?}
    F -->|Ja| G[ComplexityAnalyzer]
    F -->|Nein| E
    G --> H{Komplex genug?}
    H -->|Nein| I[Element überspringen]
    H -->|Ja| J[CodeAnalyzer + KI]
    J --> K[QualityValidator]
    K --> L{Qualität OK?}
    L -->|Nein| M[Verbesserung versuchen]
    M --> N{Besser?}
    N -->|Nein| I
    N -->|Ja| O[Notification anzeigen]
    L -->|Ja| O
    O --> P[Benutzer-Entscheidung]
    P --> Q[Statistik-Update]
    Q --> R[Learning System]
```

## 2. Komponenten-Architektur

```mermaid
classDiagram
    class ImprovedProjectMonitor {
        -debouncer: AdaptiveDebouncer
        -codeAnalyzer: CodeAnalyzer
        -learningSystem: LearningSystem
        -stats: Statistics
        +start()
        +stop()
        +analyzeDocument()
        +autoDocumentItem()
    }
    
    class ComplexityAnalyzer {
        +analyzeComplexity()
        -calculateCyclomaticComplexity()
        -calculateNestingDepth()
        -countParameters()
        -shouldDocument()
    }
    
    class QualityValidator {
        +validate()
        -checkLength()
        -checkMetaDescriptions()
        -checkRedundancy()
        -explainsWhy()
        +improve()
    }
    
    class AdaptiveDebouncer {
        -timers: Map
        -activityHistory: Map
        +debounce()
        -calculateDelay()
        -isRateLimited()
    }
    
    ImprovedProjectMonitor --> ComplexityAnalyzer : verwendet
    ImprovedProjectMonitor --> QualityValidator : verwendet
    ImprovedProjectMonitor --> AdaptiveDebouncer : verwendet
```

## 3. Datenfluss

```mermaid
sequenceDiagram
    participant U as Benutzer
    participant E as Editor
    participant M as Monitor
    participant D as Debouncer
    participant C as ComplexityAnalyzer
    participant A as CodeAnalyzer (KI)
    participant Q as QualityValidator
    participant L as LearningSystem
    
    U->>E: Schreibt neue Funktion
    E->>M: onChange Event
    M->>D: Plane Analyse
    Note over D: Wartet 3-15s (adaptiv)
    D->>M: Führe Analyse aus
    M->>C: Analysiere Komplexität
    C->>M: Komplexität: 35 (Medium)
    
    alt Komplex genug (>15)
        M->>A: Generiere Kommentar
        A->>M: KI-Kommentar
        M->>Q: Validiere Qualität
        Q->>M: Score: 85% ✅
        
        alt Qualität OK (>60)
            M->>U: Zeige Notification
            U->>M: Einfügen
            M->>E: Insert Comment
            M->>L: Speichere Training
        else Qualität schlecht
            M->>Q: Versuche Verbesserung
            Q->>M: Verbesserter Kommentar
        end
    else Zu einfach
        M->>M: Element überspringen
    end
```

## 4. Komplexitäts-Berechnung

```mermaid
graph LR
    A[Code-Block] --> B[Zyklomatische Komplexität]
    A --> C[Verschachtelungstiefe]
    A --> D[Codezeilen]
    A --> E[Parameter-Anzahl]
    A --> F[Logische Operatoren]
    
    B --> G[Gewichtete Summe]
    C --> G
    D --> G
    E --> G
    F --> G
    
    G --> H{Gesamt-Score}
    H -->|< 10| I[Trivial - Skip]
    H -->|10-20| J[Low]
    H -->|20-40| K[Medium]
    H -->|40-60| L[High]
    H -->|> 60| M[Very High]
    
    J --> N{Dokumentieren?}
    K --> O[✅ Ja]
    L --> O
    M --> O
    I --> P[❌ Nein]
    N -->|>15| O
    N -->|<15| P
```

## 5. Qualitäts-Validierung

```mermaid
graph TB
    A[Generierter Kommentar] --> B{Länge OK?}
    B -->|< 20 chars| C[❌ Zu kurz]
    B -->|20-300 chars| D{Meta-Beschreibungen?}
    B -->|> 300 chars| E[⚠️ Zu lang]
    
    D -->|Ja| F[❌ Meta-Problem]
    D -->|Nein| G{Redundanz?}
    
    G -->|> 50%| H[❌ Redundant]
    G -->|< 50%| I{Erklärt Warum?}
    
    I -->|Nein| J[⚠️ Kein Warum]
    I -->|Ja| K{Generisch?}
    
    K -->|Ja| L[❌ Zu generisch]
    K -->|Nein| M{Sprache OK?}
    
    M -->|Nein| N[🔧 Auto-Fix]
    M -->|Ja| O[✅ Qualität OK]
    
    N --> O
    
    C --> P[Gesamt-Score]
    E --> P
    F --> P
    H --> P
    J --> P
    L --> P
    O --> P
    
    P --> Q{Score?}
    Q -->|>= 80| R[🟢 Gut]
    Q -->|60-79| S[🟡 OK]
    Q -->|40-59| T[🟠 Niedrig]
    Q -->|< 40| U[🔴 Schlecht]
```

## 6. Adaptive Wartezeit

```mermaid
graph TB
    A[Basis: 5s] --> B[Faktor 1: Aktivität]
    B --> C{Änderungen/Min}
    C -->|< 5| D[1.0x]
    C -->|5-10| E[1.5x]
    C -->|> 10| F[2.0x]
    
    D --> G[Faktor 2: Komplexität]
    E --> G
    F --> G
    
    G --> H{Komplexität}
    H -->|< 20| I[1.0x]
    H -->|20-50| J[1.5x]
    H -->|> 50| K[2.0x]
    
    I --> L[Faktor 3: Typ]
    J --> L
    K --> L
    
    L --> M{Änderungs-Typ}
    M -->|Minor| N[1.0x]
    M -->|Function| O[1.1x]
    M -->|Class| P[1.3x]
    
    N --> Q[Faktor 4: Rate-Limit]
    O --> Q
    P --> Q
    
    Q --> R{API-Calls}
    R -->|< 24/30| S[1.0x]
    R -->|24-29/30| T[1.5x]
    R -->|= 30/30| U[❌ Skip]
    
    S --> V[Faktor 5: Akzeptanz]
    T --> V
    
    V --> W{Akzeptanz-Rate}
    W -->|> 70%| X[0.8x]
    W -->|30-70%| Y[1.0x]
    W -->|< 30%| Z[1.5x]
    
    X --> AA[Finale Wartezeit]
    Y --> AA
    Z --> AA
    
    AA --> AB{Begrenzung}
    AB --> AC[Min: 3s<br/>Max: 15s]
```

## 7. Statistik-Tracking

```mermaid
graph LR
    A[Events] --> B[Total Detections]
    A --> C[Documents Processed]
    A --> D[Suggestions Shown]
    A --> E[Suggestions Accepted]
    A --> F[Suggestions Rejected]
    A --> G[Quality Issues]
    
    B --> H[Dashboard]
    C --> H
    D --> H
    E --> H
    F --> H
    G --> H
    
    H --> I[Akzeptanz-Rate]
    H --> J[Qualitäts-Rate]
    H --> K[Effizienz-Metrik]
    
    I --> L[Learning System]
    J --> L
    K --> L
    
    L --> M[Adaptive Anpassung]
    M --> N[Bessere Wartezeiten]
    M --> O[Bessere Schwellwerte]
```

## 8. Entscheidungsbaum

```mermaid
graph TB
    A[Neue Code-Änderung] --> B{Code-Datei?}
    B -->|Nein| C[Ignorieren]
    B -->|Ja| D{Signifikant?}
    D -->|Nein| C
    D -->|Ja| E[In Debouncer-Queue]
    E --> F[Wartezeit abgelaufen]
    F --> G{Rate-Limit OK?}
    G -->|Nein| H[Warte 1 Stunde]
    G -->|Ja| I{Bereits dokumentiert?}
    I -->|Ja| C
    I -->|Nein| J[Komplexitäts-Analyse]
    J --> K{Komplex >= 15?}
    K -->|Nein| C
    K -->|Ja| L[KI-Kommentar generieren]
    L --> M[Qualitäts-Validierung]
    M --> N{Score >= 60?}
    N -->|Nein| O{Verbesserbar?}
    O -->|Nein| C
    O -->|Ja| P[Verbesserung anwenden]
    P --> Q[Notification zeigen]
    N -->|Ja| Q
    Q --> R{Benutzer-Aktion?}
    R -->|Einfügen| S[Kommentar einfügen]
    R -->|Bearbeiten| T[Edit-Dialog]
    R -->|Preview| U[Preview anzeigen]
    R -->|Ignorieren| V[Statistik: Rejected]
    S --> W[Statistik: Accepted]
    T --> W
    W --> X[Learning System Update]
```

## Verwendung in Diplomarbeit

### Für Architektur-Kapitel:
- Diagramm 1: System-Übersicht
- Diagramm 2: Komponenten-Architektur

### Für Implementierung-Kapitel:
- Diagramm 3: Datenfluss
- Diagramm 4: Komplexitäts-Berechnung
- Diagramm 5: Qualitäts-Validierung

### Für Algorithmen-Kapitel:
- Diagramm 6: Adaptive Wartezeit
- Diagramm 8: Entscheidungsbaum

### Für Evaluation-Kapitel:
- Diagramm 7: Statistik-Tracking

## Rendering

Diese Diagramme können in VS Code mit der "Markdown Preview Mermaid Support" Extension angezeigt werden, oder online auf:
- https://mermaid.live/
- https://mermaid.ink/

Für die Diplomarbeit als Bilder exportieren:
1. Öffne https://mermaid.live/
2. Paste Diagramm-Code
3. Export als PNG/SVG
4. In Word/LaTeX einfügen
