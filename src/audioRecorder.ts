import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

export class AudioRecorder {
  private isRecording: boolean = false;
  private recordingProcess: any = null;
  private audioFilePath: string = "";
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Voice Doc Audio");
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error("Aufnahme läuft bereits");
    }

    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = new Date().getTime();
    this.audioFilePath = path.join(tempDir, `recording_${timestamp}.wav`);

    this.outputChannel.appendLine(
      `Starting recording to: ${this.audioFilePath}`
    );

    try {
      await this.startRecordingWithTool();
      this.isRecording = true;
      this.outputChannel.appendLine("Recording started successfully");
    } catch (error) {
      this.outputChannel.appendLine(`Error starting recording: ${error}`);
      throw error;
    }
  }

  private async startRecordingWithTool(): Promise<void> {
    if (process.platform === "win32") {
      await this.startWindowsRecording();
    } else if (process.platform === "darwin") {
      await this.startMacRecording();
    } else {
      await this.startLinuxRecording();
    }
  }

  private async startWindowsRecording(): Promise<void> {
    const psScript = `
Add-Type @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class AudioRecorder {
    [DllImport("winmm.dll", SetLastError = true)]
    public static extern uint waveInOpen(ref IntPtr phwi, uint uDeviceID, ref WAVEFORMATEX lpFormat, IntPtr dwCallback, IntPtr dwInstance, uint dwFlags);
    
    public struct WAVEFORMATEX {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }
}
"@

# Simplified: Use built-in Windows Voice Recorder via COM
\$source = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class SimpleRecorder {
    public static void StartRecording(string outputPath, int durationMs) {
        // This is a placeholder - real implementation would use NAudio or similar
        Console.WriteLine("Recording audio for " + durationMs + "ms to " + outputPath);
        Thread.Sleep(durationMs);
        Console.WriteLine("Recording complete");
    }
}
"@

Add-Type -TypeDefinition \$source
[SimpleRecorder]::StartRecording("${this.audioFilePath}", 60000)
`;

    this.outputChannel.appendLine(
      "Windows recording: Creating placeholder audio file"
    );

    const wavHeader = this.createEmptyWavFile();
    fs.writeFileSync(this.audioFilePath, wavHeader);

    vscode.window.showInformationMessage(
      "⚠️ Audio-Aufnahme ist simuliert. Für echte Aufnahme installiere bitte sox: https://sox.sourceforge.net/"
    );
  }

  private async startMacRecording(): Promise<void> {
    try {
      this.recordingProcess = spawn("rec", [
        this.audioFilePath,
        "rate",
        "16000",
        "channels",
        "1",
      ]);
    } catch {
      this.recordingProcess = spawn("afrecord", [
        "-f",
        "WAVE",
        "-r",
        "16000",
        this.audioFilePath,
      ]);
    }
  }

  private async startLinuxRecording(): Promise<void> {
    try {
      this.recordingProcess = spawn("arecord", [
        "-f",
        "S16_LE",
        "-r",
        "16000",
        "-c",
        "1",
        this.audioFilePath,
      ]);
    } catch {
      this.recordingProcess = spawn("rec", [
        this.audioFilePath,
        "rate",
        "16000",
        "channels",
        "1",
      ]);
    }
  }

  async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      throw new Error("Keine aktive Aufnahme");
    }

    this.isRecording = false;

    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
    }

    this.outputChannel.appendLine(
      `Recording stopped. File saved to: ${this.audioFilePath}`
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    return this.audioFilePath;
  }

  private createEmptyWavFile(): Buffer {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const duration = 0.1;

    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const fileSize = 44 + dataSize;

    const buffer = Buffer.alloc(fileSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);
    return buffer;
  }

  getAudioFilePath(): string {
    return this.audioFilePath;
  }

  cleanup(): void {
    const tempDir = path.join(__dirname, "..", "temp");
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach((file) => {
        if (file.endsWith(".wav")) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      });
    }
  }
}
