/**
 * 🔒 Rate Limiter für API-Calls
 * Verhindert Kostenexplosion durch zu viele Requests
 */
export class RateLimiter {
    private callTimestamps: number[] = [];
    private readonly maxCallsPerMinute: number;
    private readonly windowMs: number;

    constructor(maxCallsPerMinute: number = 20, windowMs: number = 60000) {
        this.maxCallsPerMinute = maxCallsPerMinute;
        this.windowMs = windowMs;
    }

    /**
     * Prüft ob Rate Limit erreicht ist
     * @throws Error wenn Limit erreicht
     */
    async checkLimit(): Promise<void> {
        const now = Date.now();
        
        // Entferne alte Timestamps außerhalb des Zeitfensters
        this.callTimestamps = this.callTimestamps.filter(
            timestamp => now - timestamp < this.windowMs
        );

        // Prüfe ob Limit erreicht
        if (this.callTimestamps.length >= this.maxCallsPerMinute) {
            const oldestCall = this.callTimestamps[0];
            const waitTime = this.windowMs - (now - oldestCall);
            const waitSeconds = Math.ceil(waitTime / 1000);
            
            throw new Error(
                `⚠️ Rate Limit erreicht! Bitte ${waitSeconds} Sekunden warten.\n` +
                `(${this.callTimestamps.length}/${this.maxCallsPerMinute} Calls in der letzten Minute)`
            );
        }

        // Registriere neuen Call
        this.callTimestamps.push(now);
    }

    /**
     * Gibt aktuelle Nutzungs-Statistik zurück
     */
    getUsageStats(): {
        callsInWindow: number;
        maxCalls: number;
        percentUsed: number;
        remaining: number;
    } {
        const now = Date.now();
        this.callTimestamps = this.callTimestamps.filter(
            timestamp => now - timestamp < this.windowMs
        );

        const callsInWindow = this.callTimestamps.length;
        const remaining = Math.max(0, this.maxCallsPerMinute - callsInWindow);
        const percentUsed = (callsInWindow / this.maxCallsPerMinute) * 100;

        return {
            callsInWindow,
            maxCalls: this.maxCallsPerMinute,
            percentUsed: Math.round(percentUsed),
            remaining
        };
    }

    /**
     * Setzt Rate Limiter zurück
     */
    reset(): void {
        this.callTimestamps = [];
    }
}
