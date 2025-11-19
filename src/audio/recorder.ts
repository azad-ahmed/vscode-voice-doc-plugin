import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { FileSystemHelper } from '../utils/fileSystemHelper';
import { ErrorHandler } from '../utils/errorHandler';

export class AudioRecorder {
    private isRecording: boolean = false;
    private recordingProcess: ChildProcess | null = null;
    private audioFilePath: string = '';
    private tempDir: string;
    
    // 🔒 Race Condition Prevention
    private cleanupLock: boolean = false;
    
    // 🔒 Whitelist für erlaubte Audio-Geräte (Command Injection Prevention)
    private static readonly ALLOWED_DEVICES = [
        'Microphone',
        'Default',
        'Built-in Microphone',
        'Internal Microphone',
        'Mikrofon'
    ];

    constructor() {
        this.tempDir = path.join(__dirname, '..', '..', 'temp');
        FileSystemHelper.ensureDirectoryExists(this.tempDir);
    }

    async start(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Aufnahme läuft bereits');
        }

        const timestamp = Date.now();
        this.audioFilePath = path.join(this.tempDir, `recording_${timestamp}.wav`);

        ErrorHandler.log('AudioRecorder', `Starte Aufnahme: ${this.audioFilePath}`);

        try {
            await this.startPlatformSpecificRecording();
            this.isRecording = true;
            ErrorHandler.log('AudioRecorder', 'Aufnahme gestartet', 'success');
        } catch (error: any) {
            ErrorHandler.handleError('AudioRecorder', error);
            throw error;
        }
    }

    /**
     * 🔒 SICHERHEIT: Validiert Gerätenamen gegen Whitelist
     */
    private sanitizeDeviceName(device: string): string {
        if (!AudioRecorder.ALLOWED_DEVICES.includes(device)) {
            ErrorHandler.log('AudioRecorder', `⚠️ Ungültiger Gerätename: ${device}, verwende Default`);
            return 'Default';
        }
        return device;
    }

    private async startPlatformSpecificRecording(): Promise<void> {
        const platform = process.platform;

        switch (platform) {
            case 'win32':
                await this.startWindowsRecording();
                break;
            case 'darwin':
                await this.startMacRecording();
                break;
            case 'linux':
                await this.startLinuxRecording();
                break;
            default:
                throw new Error(`Platform nicht unterstützt: ${platform}`);
        }
    }

    private async startWindowsRecording(): Promise<void> {
        const methods = [
            { name: 'FFmpeg', fn: () => this.tryFFmpegRecording() },
            { name: 'SoX', fn: () => this.trySoxRecording() }
        ];

        let lastError: Error | null = null;

        for (const method of methods) {
            try {
                ErrorHandler.log('AudioRecorder', `Versuche ${method.name}...`);
                await method.fn();
                return;
            } catch (error: any) {
                lastError = error;
                ErrorHandler.log('AudioRecorder', `${method.name} nicht verfügbar`);
                continue;
            }
        }

        const userConfirmed = await this.showRecordingUnavailableDialog();
        
        if (!userConfirmed) {
            throw new Error('Benutzer hat Demo-Aufnahme abgelehnt');
        }

        await this.createSimulatedRecording();
    }

    private async showRecordingUnavailableDialog(): Promise<boolean> {
        const action = await vscode.window.showWarningMessage(
            '⚠️ Keine Audio-Aufnahme-Software gefunden\n\n' +
            'Für echte Aufnahmen installieren Sie bitte:\n' +
            '• FFmpeg: https://ffmpeg.org/download.html\n' +
            '• oder SoX: http://sox.sourceforge.net/\n\n' +
            'Möchten Sie im Demo-Modus fortfahren?',
            { modal: true },
            'Demo-Modus verwenden',
            'Installation-Anleitung',
            'Abbrechen'
        );

        if (action === 'Installation-Anleitung') {
            vscode.env.openExternal(vscode.Uri.parse('https://ffmpeg.org/download.html'));
            return false;
        }

        return action === 'Demo-Modus verwenden';
    }

    private async createSimulatedRecording(): Promise<void> {
        ErrorHandler.log('AudioRecorder', '⚠️ Erstelle simulierte Aufnahme');

        const wavHeader = this.createWavHeader(16000, 1, 16);
        const silenceData = Buffer.alloc(16000 * 1 * 2);
        const fullWav = Buffer.concat([wavHeader, silenceData]);

        await FileSystemHelper.writeFileAsync(this.audioFilePath, fullWav);

        vscode.window.showWarningMessage(
            '⚠️ Demo-Modus: Simulierte Aufnahme wird verwendet'
        );
    }

    private async tryFFmpegRecording(): Promise<void> {
        // 🔒 SICHERHEIT: Validiere Gerätename BEVOR er verwendet wird
        const deviceName = 'Microphone'; // Standard-Gerät
        const sanitizedDevice = this.sanitizeDeviceName(deviceName);
        
        this.recordingProcess = spawn('ffmpeg', [
            '-f', 'dshow',
            '-i', `audio=${sanitizedDevice}`, // ✅ JETZT SANITIZED
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            this.audioFilePath // Path ist intern generiert
        ]);

        return this.waitForProcessStart('FFmpeg');
    }

    private async trySoxRecording(): Promise<void> {
        // 🔒 SICHERHEIT: Nur statische Parameter
        this.recordingProcess = spawn('sox', [
            '-d',
            '-r', '16000',
            '-c', '1',
            '-b', '16',
            this.audioFilePath
        ]);

        return this.waitForProcessStart('SoX');
    }

    private async startMacRecording(): Promise<void> {
        const methods = [
            { name: 'rec (SoX)', fn: () => this.tryMacBuiltinRecording() },
            { name: 'FFmpeg', fn: () => this.tryFFmpegRecording() }
        ];

        let lastError: Error | null = null;

        for (const method of methods) {
            try {
                ErrorHandler.log('AudioRecorder', `Versuche ${method.name}...`);
                await method.fn();
                return;
            } catch (error: any) {
                lastError = error;
                continue;
            }
        }

        throw new Error('Keine Audio-Aufnahme-Software für macOS gefunden');
    }

    private async tryMacBuiltinRecording(): Promise<void> {
        this.recordingProcess = spawn('rec', [
            this.audioFilePath,
            'rate', '16000',
            'channels', '1',
            'bits', '16'
        ]);

        return this.waitForProcessStart('rec');
    }

    private async startLinuxRecording(): Promise<void> {
        const methods = [
            { name: 'arecord (ALSA)', fn: () => this.tryAlsaRecording() },
            { name: 'parecord (PulseAudio)', fn: () => this.tryPulseAudioRecording() },
            { name: 'FFmpeg', fn: () => this.tryFFmpegRecording() }
        ];

        let lastError: Error | null = null;

        for (const method of methods) {
            try {
                ErrorHandler.log('AudioRecorder', `Versuche ${method.name}...`);
                await method.fn();
                return;
            } catch (error: any) {
                lastError = error;
                continue;
            }
        }

        throw new Error('Keine Audio-Aufnahme-Software für Linux gefunden');
    }

    private async tryAlsaRecording(): Promise<void> {
        this.recordingProcess = spawn('arecord', [
            '-f', 'S16_LE',
            '-r', '16000',
            '-c', '1',
            this.audioFilePath
        ]);

        return this.waitForProcessStart('arecord');
    }

    private async tryPulseAudioRecording(): Promise<void> {
        this.recordingProcess = spawn('parecord', [
            '--format=s16le',
            '--rate=16000',
            '--channels=1',
            this.audioFilePath
        ]);

        return this.waitForProcessStart('parecord');
    }

    private async waitForProcessStart(processName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.recordingProcess) {
                reject(new Error('Recording-Prozess nicht gestartet'));
                return;
            }

            let hasError = false;

            this.recordingProcess.on('error', (error) => {
                hasError = true;
                reject(new Error(`${processName} nicht verfügbar: ${error.message}`));
            });

            this.recordingProcess.on('spawn', () => {
                if (!hasError) {
                    resolve();
                }
            });

            setTimeout(() => {
                if (!hasError && this.recordingProcess && !this.recordingProcess.killed) {
                    resolve();
                } else if (!hasError) {
                    reject(new Error(`${processName} konnte nicht gestartet werden`));
                }
            }, 3000);
        });
    }

    async stop(): Promise<string> {
        if (!this.isRecording) {
            throw new Error('Keine aktive Aufnahme');
        }

        this.isRecording = false;

        if (this.recordingProcess && !this.recordingProcess.killed) {
            try {
                this.recordingProcess.kill('SIGTERM');

                setTimeout(() => {
                    if (this.recordingProcess && !this.recordingProcess.killed) {
                        this.recordingProcess.kill('SIGKILL');
                    }
                }, 2000);
            } catch (error) {
                ErrorHandler.log('AudioRecorder', `Fehler beim Stoppen: ${error}`);
            }

            this.recordingProcess = null;
        }

        if (!FileSystemHelper.fileExists(this.audioFilePath)) {
            const wavHeader = this.createWavHeader(16000, 1, 16);
            await FileSystemHelper.writeFileAsync(this.audioFilePath, wavHeader);
        }

        ErrorHandler.log('AudioRecorder', `Aufnahme gestoppt: ${this.audioFilePath}`, 'success');
        return this.audioFilePath;
    }

    private createWavHeader(
        sampleRate: number,
        channels: number,
        bitsPerSample: number
    ): Buffer {
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = channels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = sampleRate * channels * bytesPerSample * 0.1;
        const fileSize = 44 + dataSize;

        const buffer = Buffer.alloc(44);

        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(fileSize - 8, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20);
        buffer.writeUInt16LE(channels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(byteRate, 28);
        buffer.writeUInt16LE(blockAlign, 32);
        buffer.writeUInt16LE(bitsPerSample, 34);
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);

        return buffer;
    }

    async forceStop(): Promise<void> {
        if (this.recordingProcess) {
            try {
                this.recordingProcess.kill('SIGKILL');
            } catch (error) {
                ErrorHandler.log('AudioRecorder', `Force stop Fehler: ${error}`);
            }
            this.recordingProcess = null;
        }
        this.isRecording = false;
    }

    async cleanup(): Promise<void> {
        // 🔒 KRITISCH: Race Condition Prevention
        if (this.cleanupLock) {
            ErrorHandler.log('AudioRecorder', 'Cleanup bereits aktiv, überspringe');
            return;
        }
        
        this.cleanupLock = true;
        
        try {
            const deletedCount = await FileSystemHelper.deleteOldFiles(
                this.tempDir,
                ['.wav', '.mp3', '.bat'],
                60 * 60 * 1000
            );

            if (deletedCount > 0) {
                ErrorHandler.log('AudioRecorder', `${deletedCount} alte Dateien gelöscht`);
            }
        } catch (error) {
            ErrorHandler.log('AudioRecorder', `Cleanup Fehler: ${error}`);
        } finally {
            // 🔒 Lock IMMER freigeben (auch bei Fehler)
            this.cleanupLock = false;
        }
    }

    getLastRecordingPath(): string {
        return this.audioFilePath;
    }

    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    dispose(): void {
        this.forceStop();
        this.cleanup();
    }
}
