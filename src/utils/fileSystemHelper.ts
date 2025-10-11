import * as fs from 'fs';
import * as path from 'path';

/**
 * Hilfsfunktionen für Dateisystemoperationen
 */
export class FileSystemHelper {
    static ensureDirectoryExists(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    static fileExists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    static async readFileAsync(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
        return fs.promises.readFile(filePath, encoding);
    }

    static async writeFileAsync(filePath: string, content: string | Buffer): Promise<void> {
        await fs.promises.writeFile(filePath, content);
    }

    static deleteFile(filePath: string): void {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    static async deleteOldFiles(
        directory: string,
        extensions: string[],
        olderThanMs: number
    ): Promise<number> {
        if (!fs.existsSync(directory)) {
            return 0;
        }

        const files = await fs.promises.readdir(directory);
        const threshold = Date.now() - olderThanMs;
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(directory, file);
            
            if (extensions.some(ext => file.endsWith(ext))) {
                try {
                    const stats = await fs.promises.stat(filePath);
                    
                    if (stats.mtime.getTime() < threshold) {
                        await fs.promises.unlink(filePath);
                        deletedCount++;
                    }
                } catch (error) {
                    console.error(`Fehler beim Löschen von ${file}:`, error);
                }
            }
        }

        return deletedCount;
    }

    static getFileSize(filePath: string): number {
        if (!fs.existsSync(filePath)) {
            return 0;
        }
        const stats = fs.statSync(filePath);
        return stats.size;
    }

    static async validateAudioFile(filePath: string): Promise<boolean> {
        if (!fs.existsSync(filePath)) {
            return false;
        }

        const stats = await fs.promises.stat(filePath);
        
        if (stats.size < 100) {
            return false;
        }

        const buffer = await fs.promises.readFile(filePath);
        const header = buffer.slice(0, 4).toString('ascii');
        
        return header === 'RIFF';
    }
}
