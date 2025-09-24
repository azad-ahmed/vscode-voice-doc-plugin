import * as vscode from 'vscode';
import { CommentGenerator } from './generator';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class IntegratedVoiceHandler {
    private generator: CommentGenerator;
    private context: vscode.ExtensionContext;
    private statusBar: vscode.StatusBarItem;
    private isRecording: boolean = false;
    private recordingProcess: child_process.ChildProcess | null = null;

    constructor(context: vscode.ExtensionContext, generator: CommentGenerator) {
        this.context = context;
        this.generator = generator;
        
        // Status Bar Item für Voice Status
        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBar.text = '$(mic) Voice Docs';
        this.statusBar.command = 'voiceDocs.toggleRecording';
        this.statusBar.show();
    }

    /**
     * Option 1: Quick Input für Text-Eingabe (Fallback)
     */
    async showQuickInput() {
        const input = await vscode.window.showInputBox({
            prompt: 'Beschreiben Sie Ihren Code (oder nutzen Sie System-Spracherkennung)',
            placeHolder: 'z.B. Diese Funktion berechnet die Summe aller Elemente...',
            ignoreFocusOut: true
        });

        if (input) {
            await this.processText(input);
        }
    }

    /**
     * Option 2: System Speech-to-Text mit PowerShell (Windows)
     */
    async startWindowsSpeechRecognition() {
        if (process.platform !== 'win32') {
            vscode.window.showErrorMessage('Diese Funktion ist nur unter Windows verfügbar');
            return;
        }

        const psScript = `
Add-Type -AssemblyName System.Speech
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToDefaultAudioDevice()
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($grammar)

Write-Host "Sprechen Sie jetzt..."

$result = $recognizer.Recognize()
if ($result -ne $null) {
    Write-Output $result.Text
} else {
    Write-Output "Keine Sprache erkannt"
}
        `;

        try {
            const result = await this.executePowerShell(psScript);
            if (result && result !== 'Keine Sprache erkannt') {
                await this.processText(result);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Fehler bei Spracherkennung: ${error}`);
        }
    }

    /**
     * Option 3: Externes Tool nutzen (z.B. Windows Voice Typing)
     */
    async useSystemVoiceTyping() {
        if (process.platform === 'win32') {
            // Windows Voice Typing aktivieren
            const message = await vscode.window.showInformationMessage(
                'Windows Voice Typing aktivieren:\n1. Drücken Sie Win+H\n2. Sprechen Sie Ihren Text\n3. Kopieren Sie den Text und fügen Sie ihn hier ein',
                'Text eingeben', 'Abbrechen'
            );

            if (message === 'Text eingeben') {
                await this.showQuickInput();
            }
        } else if (process.platform === 'darwin') {
            // macOS Diktat
            const message = await vscode.window.showInformationMessage(
                'macOS Diktat aktivieren:\n1. Drücken Sie Fn Fn (zweimal)\n2. Sprechen Sie Ihren Text\n3. Kopieren Sie den Text und fügen Sie ihn hier ein',
                'Text eingeben', 'Abbrechen'
            );

            if (message === 'Text eingeben') {
                await this.showQuickInput();
            }
        } else {
            await this.showQuickInput();
        }
    }

    /**
     * Option 4: Multi-Step Input für strukturierte Eingabe
     */
    async showMultiStepInput() {
        // Schritt 1: Was macht der Code?
        const description = await vscode.window.showInputBox({
            title: 'Schritt 1/3: Hauptfunktion',
            prompt: 'Was macht dieser Code?',
            placeHolder: 'z.B. Berechnet die Steuern basierend auf dem Einkommen'
        });

        if (!description) return;

        // Schritt 2: Parameter (optional)
        const hasParams = await vscode.window.showQuickPick(
            ['Ja, es gibt Parameter', 'Nein, keine Parameter'],
            { title: 'Schritt 2/3: Hat die Funktion Parameter?' }
        );

        let parameters = '';
        if (hasParams === 'Ja, es gibt Parameter') {
            parameters = await vscode.window.showInputBox({
                prompt: 'Beschreiben Sie die Parameter',
                placeHolder: 'z.B. amount: Betrag in Euro, rate: Steuersatz'
            }) || '';
        }

        // Schritt 3: Rückgabewert (optional)
        const returnValue = await vscode.window.showInputBox({
            title: 'Schritt 3/3: Rückgabewert',
            prompt: 'Was gibt die Funktion zurück? (optional)',
            placeHolder: 'z.B. Den berechneten Steuerbetrag'
        });

        // Kombiniere alle Eingaben
        let fullText = description;
        if (parameters) fullText += `. Parameter: ${parameters}`;
        if (returnValue) fullText += `. Rückgabe: ${returnValue}`;

        await this.processText(fullText);
    }

    /**
     * Option 5: Clipboard-Monitoring für Voice Input
     */
    async startClipboardMonitoring() {
        const panel = vscode.window.createWebviewPanel(
            'voiceInstructions',
            'Voice Documentation Anleitung',
            vscode.ViewColumn.Beside,
            { enableScripts: false }
        );

        panel.webview.html = `
            <html>
            <body style="padding: 20px;">
                <h2>Voice Documentation - Anleitung</h2>
                <ol>
                    <li><strong>Öffnen Sie ein Spracheingabe-Tool:</strong>
                        <ul>
                            <li>Windows: Win+H für Voice Typing</li>
                            <li>macOS: Fn+Fn für Diktat</li>
                            <li>Oder nutzen Sie ein Tool wie Google Docs Voice Typing</li>
                        </ul>
                    </li>
                    <li><strong>Sprechen Sie Ihre Dokumentation</strong></li>
                    <li><strong>Kopieren Sie den Text (Ctrl+C)</strong></li>
                    <li><strong>Klicken Sie auf "Text verarbeiten" unten</strong></li>
                </ol>
                <p>Status: Warte auf kopierten Text...</p>
            </body>
            </html>
        `;

        const action = await vscode.window.showInformationMessage(
            'Kopieren Sie Ihren gesprochenen Text und klicken Sie dann auf "Text verarbeiten"',
            'Text verarbeiten',
            'Abbrechen'
        );

        panel.dispose();

        if (action === 'Text verarbeiten') {
            // Lese aus Clipboard
            const clipboardText = await vscode.env.clipboard.readText();
            if (clipboardText) {
                await this.processText(clipboardText);
            } else {
                vscode.window.showWarningMessage('Kein Text in der Zwischenablage gefunden');
            }
        }
    }

    /**
     * Haupt-Toggle Funktion
     */
    async toggleRecording() {
        const options = [
            '$(keyboard) Text direkt eingeben',
            '$(clippy) System-Spracherkennung nutzen', 
            '$(checklist) Strukturierte Eingabe',
            '$(link-external) Clipboard-Methode'
        ];

        if (process.platform === 'win32') {
            options.push('$(terminal) Windows Speech Recognition');
        }

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'Wählen Sie eine Eingabemethode'
        });

        switch (choice) {
            case '$(keyboard) Text direkt eingeben':
                await this.showQuickInput();
                break;
            case '$(clippy) System-Spracherkennung nutzen':
                await this.useSystemVoiceTyping();
                break;
            case '$(checklist) Strukturierte Eingabe':
                await this.showMultiStepInput();
                break;
            case '$(link-external) Clipboard-Methode':
                await this.startClipboardMonitoring();
                break;
            case '$(terminal) Windows Speech Recognition':
                await this.startWindowsSpeechRecognition();
                break;
        }
    }

    /**
     * Text verarbeiten und als Kommentar einfügen
     */
    private async processText(text: string) {
        if (!text || text.trim().length === 0) {
            vscode.window.showWarningMessage('Kein Text zum Verarbeiten');
            return;
        }

        vscode.window.setStatusBarMessage(`$(sync~spin) Verarbeite: "${text.substring(0, 50)}..."`, 3000);

        try {
            // Nutze AI-enhanced Generator
            const comment = await this.generator.processVoiceInput(text);
            
            vscode.window.showInformationMessage('✅ Kommentar erfolgreich eingefügt!');
            
            // Optional: Zeige Preview
            const preview = await vscode.window.showInformationMessage(
                `Kommentar eingefügt:\n${comment.substring(0, 100)}...`,
                'OK',
                'Rückgängig'
            );

            if (preview === 'Rückgängig') {
                await vscode.commands.executeCommand('undo');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Fehler: ${error}`);
        }
    }

    /**
     * PowerShell Script ausführen (Windows only)
     */
    private executePowerShell(script: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const tempFile = path.join(this.context.globalStoragePath, 'speech.ps1');
            
            // Stelle sicher, dass der Ordner existiert
            if (!fs.existsSync(this.context.globalStoragePath)) {
                fs.mkdirSync(this.context.globalStoragePath, { recursive: true });
            }

            fs.writeFileSync(tempFile, script);

            child_process.exec(
                `powershell -ExecutionPolicy Bypass -File "${tempFile}"`,
                (error, stdout, stderr) => {
                    // Cleanup
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }

                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdout.trim());
                    }
                }
            );
        });
    }

    dispose() {
        this.statusBar.dispose();
        if (this.recordingProcess) {
            this.recordingProcess.kill();
        }
    }
}