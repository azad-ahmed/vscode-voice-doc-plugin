import { STTProvider } from '../factory';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export class WhisperProvider implements STTProvider {
    private modelPath?: string;
    private language: string;

    constructor(modelPath?: string, language: string = 'de') {
        this.modelPath = modelPath;
        this.language = language;
    }

    async transcribe(audioFilePath: string): Promise<string> {
        try {
            // Versuche verschiedene Whisper-Installationen zu finden
            const whisperCommands = ['whisper', 'python -m whisper', 'whisper.exe'];
            
            for (const command of whisperCommands) {
                try {
                    const result = await this.runWhisper(command, audioFilePath);
                    return result;
                } catch (error) {
                    continue; // Versuche nächsten Befehl
                }
            }

            // Fallback: Wenn Whisper nicht installiert ist
            return "OpenAI Whisper ist nicht installiert. Installieren Sie es mit: pip install openai-whisper";

        } catch (error: any) {
            return `Whisper Fehler: ${error.message}`;
        }
    }

    private async runWhisper(command: string, audioFilePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const args = [
                audioFilePath,
                '--language', this.language,
                '--output_format', 'txt',
                '--output_dir', path.dirname(audioFilePath)
            ];

            if (this.modelPath) {
                args.push('--model', this.modelPath);
            }

            const [cmd, ...cmdArgs] = command.split(' ');
            const process = spawn(cmd, [...cmdArgs, ...args]);

            let output = '';
            let errorOutput = '';

            process.stdout?.on('data', (data) => {
                output += data.toString();
            });

            process.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    // Whisper erstellt eine .txt Datei, diese lesen
                    const txtFile = audioFilePath.replace(/\.[^/.]+$/, '.txt');
                    
                    if (fs.existsSync(txtFile)) {
                        const transcript = fs.readFileSync(txtFile, 'utf8').trim();
                        fs.unlinkSync(txtFile); // Cleanup
                        resolve(transcript || 'Keine Sprache erkannt');
                    } else {
                        resolve('Transkription-Datei nicht gefunden');
                    }
                } else {
                    reject(new Error(`Whisper failed with code ${code}: ${errorOutput}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });

            // Timeout nach 30 Sekunden
            setTimeout(() => {
                process.kill();
                reject(new Error('Whisper timeout'));
            }, 30000);
        });
    }

    async isAvailable(): Promise<boolean> {
        try {
            return new Promise((resolve) => {
                const process = spawn('whisper', ['--help']);
                
                process.on('close', (code) => {
                    resolve(code === 0);
                });
                
                process.on('error', () => {
                    resolve(false);
                });

                // Quick timeout
                setTimeout(() => {
                    process.kill();
                    resolve(false);
                }, 3000);
            });
        } catch {
            return false;
        }
    }

    getName(): string {
        return 'OpenAI Whisper (Local)';
    }
}