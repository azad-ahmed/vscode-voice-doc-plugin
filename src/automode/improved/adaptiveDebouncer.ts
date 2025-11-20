/**
 * ⏱️ Adaptiver Debouncer für intelligentes Timing
 * 
 * Features:
 * - Passt Wartezeit basierend auf Aktivität an
 * - Verhindert API-Overload
 * - Lernt aus Benutzerver halten
 * - Rate-Limiting
 */
export class AdaptiveDebouncer {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private activityHistory: Map<string, number[]> = new Map();
    private baseDelay: number = 5000; // 5 Sekunden Standard
    private minDelay: number = 3000; // Minimum 3 Sekunden
    private maxDelay: number = 15000; // Maximum 15 Sekunden
    
    // Rate-Limiting
    private apiCallsInLastHour: number[] = [];
    private maxCallsPerHour: number = 30;
    
    constructor(config?: AdaptiveConfig) {
        if (config) {
            this.baseDelay = config.baseDelay ?? this.baseDelay;
            this.minDelay = config.minDelay ?? this.minDelay;
            this.maxDelay = config.maxDelay ?? this.maxDelay;
            this.maxCallsPerHour = config.maxCallsPerHour ?? this.maxCallsPerHour;
        }
    }
    
    /**
     * Plant eine Aktion mit adaptiver Verzögerung
     */
    debounce(
        key: string,
        action: () => Promise<void>,
        context?: DebounceContext
    ): void {
        // Lösche existierenden Timer
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        
        // Berechne adaptive Verzögerung
        const delay = this.calculateDelay(key, context);
        
        // Rate-Limiting Check
        if (this.isRateLimited()) {
            console.log(`⏸️ Rate-Limit erreicht, verschiebe Aktion um ${delay}ms`);
        }
        
        // Setze neuen Timer
        const timer = setTimeout(async () => {
            try {
                // Rate-Limiting Check vor Ausführung
                if (this.isRateLimited()) {
                    console.log('⚠️ Rate-Limit überschritten, überspringe Aktion');
                    return;
                }
                
                // Führe Aktion aus
                await action();
                
                // Tracking
                this.recordActivity(key);
                this.recordAPICall();
                
            } catch (error) {
                console.error(`Fehler in debounced action (${key}):`, error);
            } finally {
                this.timers.delete(key);
            }
        }, delay);
        
        this.timers.set(key, timer);
        
        console.log(`⏱️ Aktion "${key}" geplant in ${delay}ms`);
    }
    
    /**
     * Berechnet adaptive Verzögerung
     */
    private calculateDelay(key: string, context?: DebounceContext): number {
        let delay = this.baseDelay;
        
        // 1. Basierend auf Aktivitäts-Historie
        const history = this.activityHistory.get(key) || [];
        if (history.length > 0) {
            const recentActivity = history.filter(
                time => Date.now() - time < 60000 // Letzte Minute
            ).length;
            
            // Mehr Aktivität = längere Wartezeit
            if (recentActivity > 5) {
                delay *= 1.5;
            } else if (recentActivity > 10) {
                delay *= 2;
            }
        }
        
        // 2. Basierend auf Code-Komplexität
        if (context?.complexity) {
            // Komplexerer Code = längere Wartezeit (mehr Bedenkzeit)
            const complexityMultiplier = Math.min(2, 1 + (context.complexity / 50));
            delay *= complexityMultiplier;
        }
        
        // 3. Basierend auf Änderungs-Typ
        if (context?.changeType === 'class') {
            delay *= 1.3; // Klassen sind wichtiger, warte länger
        } else if (context?.changeType === 'function') {
            delay *= 1.1;
        }
        
        // 4. Rate-Limiting Anpassung
        const recentCalls = this.getRecentAPICalls();
        if (recentCalls > this.maxCallsPerHour * 0.8) {
            // Wenn nahe am Limit, verlangsame
            delay *= 1.5;
        }
        
        // 5. Benutzer-Akzeptanz-Rate
        if (context?.acceptanceRate !== undefined) {
            if (context.acceptanceRate < 0.3) {
                // Niedrige Akzeptanz = längere Wartezeit
                delay *= 1.5;
            } else if (context.acceptanceRate > 0.7) {
                // Hohe Akzeptanz = kann schneller sein
                delay *= 0.8;
            }
        }
        
        // Begrenze auf Min/Max
        delay = Math.max(this.minDelay, Math.min(this.maxDelay, delay));
        
        return Math.round(delay);
    }
    
    /**
     * Prüft ob Rate-Limit erreicht ist
     */
    private isRateLimited(): boolean {
        return this.getRecentAPICalls() >= this.maxCallsPerHour;
    }
    
    /**
     * Holt Anzahl API-Calls in letzter Stunde
     */
    private getRecentAPICalls(): number {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        this.apiCallsInLastHour = this.apiCallsInLastHour.filter(time => time > oneHourAgo);
        return this.apiCallsInLastHour.length;
    }
    
    /**
     * Zeichnet API-Call auf
     */
    private recordAPICall(): void {
        this.apiCallsInLastHour.push(Date.now());
    }
    
    /**
     * Zeichnet Aktivität auf
     */
    private recordActivity(key: string): void {
        const history = this.activityHistory.get(key) || [];
        history.push(Date.now());
        
        // Behalte nur letzte 20 Einträge
        if (history.length > 20) {
            history.shift();
        }
        
        this.activityHistory.set(key, history);
    }
    
    /**
     * Bricht eine geplante Aktion ab
     */
    cancel(key: string): void {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
            console.log(`❌ Aktion "${key}" abgebrochen`);
        }
    }
    
    /**
     * Bricht alle geplanten Aktionen ab
     */
    cancelAll(): void {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        console.log('❌ Alle Aktionen abgebrochen');
    }
    
    /**
     * Gibt Statistiken zurück
     */
    getStatistics(): DebouncerStatistics {
        return {
            pendingActions: this.timers.size,
            recentAPICalls: this.getRecentAPICalls(),
            rateLimitRemaining: Math.max(0, this.maxCallsPerHour - this.getRecentAPICalls()),
            trackedKeys: this.activityHistory.size,
            averageDelay: this.calculateAverageDelay()
        };
    }
    
    /**
     * Berechnet durchschnittliche Verzögerung
     */
    private calculateAverageDelay(): number {
        if (this.activityHistory.size === 0) {
            return this.baseDelay;
        }
        
        let totalDelay = 0;
        let count = 0;
        
        this.activityHistory.forEach(history => {
            for (let i = 1; i < history.length; i++) {
                totalDelay += history[i] - history[i - 1];
                count++;
            }
        });
        
        return count > 0 ? totalDelay / count : this.baseDelay;
    }
    
    /**
     * Setzt Konfiguration zurück
     */
    reset(): void {
        this.cancelAll();
        this.activityHistory.clear();
        this.apiCallsInLastHour = [];
        console.log('🔄 Debouncer zurückgesetzt');
    }
    
    /**
     * Cleanup
     */
    dispose(): void {
        this.reset();
    }
}

/**
 * Konfiguration für AdaptiveDebouncer
 */
export interface AdaptiveConfig {
    baseDelay?: number;
    minDelay?: number;
    maxDelay?: number;
    maxCallsPerHour?: number;
}

/**
 * Kontext für Debouncing-Entscheidung
 */
export interface DebounceContext {
    complexity?: number;
    changeType?: 'class' | 'function' | 'method' | 'minor';
    linesChanged?: number;
    acceptanceRate?: number;
}

/**
 * Debouncer-Statistiken
 */
export interface DebouncerStatistics {
    pendingActions: number;
    recentAPICalls: number;
    rateLimitRemaining: number;
    trackedKeys: number;
    averageDelay: number;
}
