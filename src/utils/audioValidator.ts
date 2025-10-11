import * as fs from 'fs';

/**
 * Audio-Validierung und Qualitätsprüfung
 * Prüft ob Audio-Dateien valide sind und tatsächlich Inhalt enthalten
 */
export class AudioValidator {
    
    static readonly MIN_FILE_SIZE = 1024;
    static readonly MIN_DURATION_MS = 100;
    
    static async validateAudioFile(filePath: string): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        fileSize: number;
        estimatedDuration?: number;
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!fs.existsSync(filePath)) {
            errors.push('Audio-Datei nicht gefunden');
            return { isValid: false, errors, warnings, fileSize: 0 };
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        if (fileSize < AudioValidator.MIN_FILE_SIZE) {
            errors.push(`Datei zu klein (${fileSize} bytes). Möglicherweise keine Aufnahme erfolgt.`);
        }

        const estimatedDuration = AudioValidator.estimateDuration(filePath);
        
        if (estimatedDuration !== null && estimatedDuration < AudioValidator.MIN_DURATION_MS) {
            warnings.push('Audio sehr kurz - möglicherweise keine Sprache erkannt');
        }

        const hasValidFormat = AudioValidator.checkWavFormat(filePath);
        if (!hasValidFormat) {
            errors.push('Ungültiges WAV-Format');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            fileSize,
            estimatedDuration: estimatedDuration || undefined
        };
    }

    static estimateDuration(filePath: string): number | null {
        try {
            const buffer = fs.readFileSync(filePath);
            
            if (buffer.length < 44) {
                return null;
            }

            const riff = buffer.toString('ascii', 0, 4);
            if (riff !== 'RIFF') {
                return null;
            }

            const sampleRate = buffer.readUInt32LE(24);
            const dataSize = buffer.readUInt32LE(40);
            const channels = buffer.readUInt16LE(22);
            const bitsPerSample = buffer.readUInt16LE(34);

            if (sampleRate === 0 || channels === 0 || bitsPerSample === 0) {
                return null;
            }

            const bytesPerSample = (bitsPerSample / 8) * channels;
            const duration = (dataSize / bytesPerSample / sampleRate) * 1000;

            return Math.floor(duration);
        } catch (error) {
            return null;
        }
    }

    static checkWavFormat(filePath: string): boolean {
        try {
            const buffer = fs.readFileSync(filePath, { encoding: null });
            
            if (buffer.length < 44) {
                return false;
            }

            const riff = buffer.toString('ascii', 0, 4);
            const wave = buffer.toString('ascii', 8, 12);
            
            return riff === 'RIFF' && wave === 'WAVE';
        } catch (error) {
            return false;
        }
    }

    static hasAudioContent(filePath: string): boolean {
        try {
            const stats = fs.statSync(filePath);
            
            if (stats.size < 10000) {
                return false;
            }

            const buffer = fs.readFileSync(filePath);
            const dataStart = 44;
            
            if (buffer.length <= dataStart) {
                return false;
            }

            let hasNonZero = false;
            const sampleSize = Math.min(1000, buffer.length - dataStart);
            
            for (let i = dataStart; i < dataStart + sampleSize; i++) {
                if (buffer[i] !== 0 && buffer[i] !== 128) {
                    hasNonZero = true;
                    break;
                }
            }

            return hasNonZero;
        } catch (error) {
            return false;
        }
    }
}
