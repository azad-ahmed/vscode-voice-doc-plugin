/**
 * Adaptive debouncer for intelligent timing
 * 
 * Features:
 * - Adjusts wait time based on activity
 * - Prevents API overload
 * - Learns from user behavior
 * - Rate limiting
 */
export class AdaptiveDebouncer {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private activityHistory: Map<string, number[]> = new Map();
    private baseDelay: number = 5000;
    private minDelay: number = 3000;
    private maxDelay: number = 15000;
    
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
     * Schedules an action with adaptive delay
     */
    debounce(
        key: string,
        action: () => Promise<void>,
        context?: DebounceContext
    ): void {
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        
        const delay = this.calculateDelay(key, context);
        
        if (this.isRateLimited()) {
            console.log(`Rate limit reached, postponing action by ${delay}ms`);
        }
        
        const timer = setTimeout(async () => {
            try {
                if (this.isRateLimited()) {
                    console.log('Rate limit exceeded, skipping action');
                    return;
                }
                
                await action();
                
                this.recordActivity(key);
                this.recordAPICall();
                
            } catch (error) {
                console.error(`Error in debounced action (${key}):`, error);
            } finally {
                this.timers.delete(key);
            }
        }, delay);
        
        this.timers.set(key, timer);
        
        console.log(`Action "${key}" scheduled in ${delay}ms`);
    }
    
    /**
     * Calculates adaptive delay
     */
    private calculateDelay(key: string, context?: DebounceContext): number {
        let delay = this.baseDelay;
        
        const history = this.activityHistory.get(key) || [];
        if (history.length > 0) {
            const recentActivity = history.filter(
                time => Date.now() - time < 60000
            ).length;
            
            if (recentActivity > 5) {
                delay *= 1.5;
            } else if (recentActivity > 10) {
                delay *= 2;
            }
        }
        
        if (context?.complexity) {
            const complexityMultiplier = Math.min(2, 1 + (context.complexity / 50));
            delay *= complexityMultiplier;
        }
        
        if (context?.changeType === 'class') {
            delay *= 1.3;
        } else if (context?.changeType === 'function') {
            delay *= 1.1;
        }
        
        const recentCalls = this.getRecentAPICalls();
        if (recentCalls > this.maxCallsPerHour * 0.8) {
            delay *= 1.5;
        }
        
        if (context?.acceptanceRate !== undefined) {
            if (context.acceptanceRate < 0.3) {
                delay *= 1.5;
            } else if (context.acceptanceRate > 0.7) {
                delay *= 0.8;
            }
        }
        
        delay = Math.max(this.minDelay, Math.min(this.maxDelay, delay));
        
        return Math.round(delay);
    }
    
    /**
     * Checks if rate limit is reached
     */
    private isRateLimited(): boolean {
        return this.getRecentAPICalls() >= this.maxCallsPerHour;
    }
    
    /**
     * Gets number of API calls in last hour
     */
    private getRecentAPICalls(): number {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        this.apiCallsInLastHour = this.apiCallsInLastHour.filter(time => time > oneHourAgo);
        return this.apiCallsInLastHour.length;
    }
    
    /**
     * Records an API call
     */
    private recordAPICall(): void {
        this.apiCallsInLastHour.push(Date.now());
    }
    
    /**
     * Records activity
     */
    private recordActivity(key: string): void {
        const history = this.activityHistory.get(key) || [];
        history.push(Date.now());
        
        if (history.length > 20) {
            history.shift();
        }
        
        this.activityHistory.set(key, history);
    }
    
    /**
     * Cancels a scheduled action
     */
    cancel(key: string): void {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
            console.log(`Action "${key}" cancelled`);
        }
    }
    
    /**
     * Cancels all scheduled actions
     */
    cancelAll(): void {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        console.log('All actions cancelled');
    }
    
    /**
     * Gets statistics
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
     * Calculates average delay
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
     * Resets configuration
     */
    reset(): void {
        this.cancelAll();
        this.activityHistory.clear();
        this.apiCallsInLastHour = [];
        console.log('Debouncer reset');
    }
    
    /**
     * Cleanup
     */
    dispose(): void {
        this.reset();
    }
}

export interface AdaptiveConfig {
    baseDelay?: number;
    minDelay?: number;
    maxDelay?: number;
    maxCallsPerHour?: number;
}

export interface DebounceContext {
    complexity?: number;
    changeType?: 'class' | 'function' | 'method' | 'minor';
    linesChanged?: number;
    acceptanceRate?: number;
}

export interface DebouncerStatistics {
    pendingActions: number;
    recentAPICalls: number;
    rateLimitRemaining: number;
    trackedKeys: number;
    averageDelay: number;
}
