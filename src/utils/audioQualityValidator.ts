import * as fs from 'fs';

/**
 * Validiert Audio-Dateien auf Qualität und Sprach-Content
 * um unnötige API-Aufrufe zu vermeiden
 */
export class AudioQualityValidator {
    private static readonly MIN_FILE_SIZE = 1000;
    private static readonly MAX_FILE_SIZE = 25 * 1024 * 1024;
    private static readonly MIN_DURATION_MS = 100;
    private static readonly MAX_DURATION_MS = 300000;

    static async validateAudioFile(filePath: string): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        duration?: number;
        fileSize: number;
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!fs.existsSync(filePath)) {
            errors.push('Audio-Datei existiert nicht');
            return { isValid: false, errors, warnings, fileSize: 0 };
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        if (fileSize < AudioQualityValidator.MIN_FILE_SIZE) {
            errors.push('Audio-Datei ist zu klein (möglicherweise leer)');
        }

        if (fileSize > AudioQualityValidator.MAX_FILE_SIZE) {
            errors.push('Audio-Datei ist zu groß (max. 25 MB)');
        }

        const buffer = fs.readFileSync(filePath);
        const header = buffer.slice(0, 4).toString('ascii');

        if (header !== 'RIFF') {
            errors.push('Ungültiges Audio-Format (erwartet WAV)');
            return { isValid: false, errors, warnings, fileSize };
        }

        const duration = AudioQualityValidator.calculateDuration(buffer);

        if (duration && duration < AudioQualityValidator.MIN_DURATION_MS) {
            warnings.push('Aufnahme ist sehr kurz - möglicherweise keine Sprache enthalten');
        }

        if (duration && duration > AudioQualityValidator.MAX_DURATION_MS) {
            warnings.push('Aufnahme ist sehr lang - dies kann zu höheren Kosten führen');
        }

        const hasContent = AudioQualityValidator.checkAudioLevel(buffer);
        if (!hasContent) {
            warnings.push('Audio-Pegel sehr niedrig - möglicherweise keine Sprache aufgenommen');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            duration,
            fileSize
        };
    }

    private static calculateDuration(buffer: Buffer): number | undefined {
        try {
            const sampleRate = buffer.readUInt32LE(24);
            const byteRate = buffer.readUInt32LE(28);
            const dataSize = buffer.readUInt32LE(40);

            if (sampleRate > 0 && byteRate > 0) {
                return (dataSize / byteRate) * 1000;
            }
        } catch (error) {
            console.error('Fehler beim Berechnen der Audio-Dauer:', error);
        }
        return undefined;
    }

    private static checkAudioLevel(buffer: Buffer): boolean {
        const dataStart = 44;
        const sampleSize = Math.min(buffer.length - dataStart, 16000);
        
        if (sampleSize <= 0) {
            return false;
        }

        let sum = 0;
        for (let i = dataStart; i < dataStart + sampleSize; i += 2) {
            const sample = buffer.readInt16LE(i);
            sum += Math.abs(sample);
        }

        const average = sum / (sampleSize / 2);
        const threshold = 500;

        return average > threshold;
    }

    static async quickValidation(filePath: string): Promise<boolean> {
        try {
            const result = await AudioQualityValidator.validateAudioFile(filePath);
            return result.isValid && result.warnings.length === 0;
        } catch {
            return false;
        }
    }
}
