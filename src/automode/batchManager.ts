/**
 * ⚡ KRITISCHER FIX: Batch-Processing Manager
 * Verhindert zu viele Kommentare auf einmal
 */

export interface BatchConfig {
    maxCommentsPerFile: number;
    maxCommentsPerBatch: number;
    minConfidence: number;
    debounceMs: number;
}

export interface ProcessedItem {
    key: string;
    timestamp: number;
    accepted: boolean;
}

export class BatchManager {
    private static readonly DEFAULT_CONFIG: BatchConfig = {
        maxCommentsPerFile: 5,     // Max 5 Kommentare pro Datei
        maxCommentsPerBatch: 3,     // Max 3 Kommentare gleichzeitig
        minConfidence: 0.6,         // Min 60% Konfidenz
        debounceMs: 3000            // 3 Sekunden zwischen Batches
    };

    private processedItems: Map<string, ProcessedItem> = new Map();
    private currentBatchSize: number = 0;
    private lastBatchTime: number = 0;
    private fileCommentCounts: Map<string, number> = new Map();

    constructor(private config: BatchConfig = BatchManager.DEFAULT_CONFIG) {}

    /**
     * Prüft ob Item verarbeitet werden darf
     */
    canProcess(key: string, fileUri: string, confidence: number = 1.0): boolean {
        // 1. Bereits verarbeitet?
        if (this.processedItems.has(key)) {
            return false;
        }

        // 2. Konfidenz zu niedrig?
        if (confidence < this.config.minConfidence) {
            return false;
        }

        // 3. Datei-Limit erreicht?
        const fileCount = this.fileCommentCounts.get(fileUri) || 0;
        if (fileCount >= this.config.maxCommentsPerFile) {
            console.log(`⚠️ Datei-Limit erreicht für ${fileUri}: ${fileCount}/${this.config.maxCommentsPerFile}`);
            return false;
        }

        // 4. Batch-Limit erreicht?
        if (this.currentBatchSize >= this.config.maxCommentsPerBatch) {
            console.log(`⚠️ Batch-Limit erreicht: ${this.currentBatchSize}/${this.config.maxCommentsPerBatch}`);
            return false;
        }

        // 5. Debounce nicht abgelaufen?
        const now = Date.now();
        if (now - this.lastBatchTime < this.config.debounceMs) {
            return false;
        }

        return true;
    }

    /**
     * Registriert verarbeitetes Item
     */
    markProcessed(key: string, fileUri: string, accepted: boolean = true): void {
        this.processedItems.set(key, {
            key,
            timestamp: Date.now(),
            accepted
        });

        if (accepted) {
            const currentCount = this.fileCommentCounts.get(fileUri) || 0;
            this.fileCommentCounts.set(fileUri, currentCount + 1);
            this.currentBatchSize++;
        }
    }

    /**
     * Reset Batch (nach Debounce)
     */
    resetBatch(): void {
        this.currentBatchSize = 0;
        this.lastBatchTime = Date.now();
    }

    /**
     * Reset für Datei (wenn Datei geschlossen)
     */
    resetFile(fileUri: string): void {
        this.fileCommentCounts.delete(fileUri);
        
        // Entferne alle Items dieser Datei
        const keysToDelete: string[] = [];
        this.processedItems.forEach((item, key) => {
            if (key.startsWith(fileUri)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(k => this.processedItems.delete(k));
    }

    /**
     * Statistiken
     */
    getStatistics() {
        return {
            totalProcessed: this.processedItems.size,
            acceptedItems: Array.from(this.processedItems.values()).filter(i => i.accepted).length,
            currentBatchSize: this.currentBatchSize,
            fileCommentCounts: Object.fromEntries(this.fileCommentCounts)
        };
    }

    /**
     * Cleanup alte Items (älter als 1 Stunde)
     */
    cleanup(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        const toDelete: string[] = [];

        this.processedItems.forEach((item, key) => {
            if (now - item.timestamp > maxAgeMs) {
                toDelete.push(key);
            }
        });

        toDelete.forEach(k => this.processedItems.delete(k));
        console.log(`🧹 Cleanup: ${toDelete.length} alte Items entfernt`);
    }
}
