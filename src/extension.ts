import * as vscode from 'vscode';
import { AudioRecorder } from './audioRecorder';


let audioRecorder: AudioRecorder;

export function activate(context: vscode.ExtensionContext) {
    console.log('Voice Documentation Plugin ist jetzt aktiv!');
    

    audioRecorder = new AudioRecorder();
    

    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        100
    );
    statusBarItem.text = "$(mic) Voice Doc";
    statusBarItem.tooltip = "Klicken für Sprachaufnahme (Ctrl+Alt+R)";
    statusBarItem.command = 'voiceDoc.startRecording';
    statusBarItem.show();
    
    let isRecording = false;
    

    const startRecordingCommand = vscode.commands.registerCommand(
        'voiceDoc.startRecording', 
        async () => {
            if (isRecording) {
                vscode.window.showInformationMessage('Aufnahme läuft bereits...');
                return;
            }
            
            try {

                await audioRecorder.startRecording();
                
                isRecording = true;
                statusBarItem.text = "$(stop-circle) Recording...";
                statusBarItem.command = 'voiceDoc.stopRecording';
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                
                vscode.window.showInformationMessage('🎤 Sprachaufnahme gestartet! Sprechen Sie Ihren Kommentar...');
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Fehler beim Starten der Aufnahme: ${error.message}`);
                console.error('Recording error:', error);
            }
        }
    );
    

    const stopRecordingCommand = vscode.commands.registerCommand(
        'voiceDoc.stopRecording', 
        async () => {
            if (!isRecording) {
                return;
            }
            
            try {

                const audioFilePath = await audioRecorder.stopRecording();
                
                isRecording = false;
                statusBarItem.text = "$(mic) Voice Doc";
                statusBarItem.command = 'voiceDoc.startRecording';
                statusBarItem.backgroundColor = undefined;
                
                vscode.window.showInformationMessage('⏹️ Aufnahme beendet! Verarbeite Audio...');
                

                await processRecording(audioFilePath);
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Fehler beim Stoppen der Aufnahme: ${error.message}`);
                console.error('Stop recording error:', error);
                isRecording = false;
            }
        }
    );
    

    const configureCommand = vscode.commands.registerCommand(
        'voiceDoc.configure', 
        () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'voiceDoc');
        }
    );

    const testSTTCommand = vscode.commands.registerCommand(
        'voiceDoc.testSTT',
        async () => {
            const testText = await vscode.window.showInputBox({
                prompt: 'Test-Text für Speech-to-Text Simulation',
                placeHolder: 'Diese Funktion berechnet die Summe...'
            });
            
            if (testText) {
                await insertComment(testText);
            }
        }
    );
    

    context.subscriptions.push(
        startRecordingCommand,
        stopRecordingCommand,
        configureCommand,
        testSTTCommand,
        statusBarItem
    );

    vscode.window.showInformationMessage('Voice Documentation Plugin bereit! Nutze Ctrl+Alt+R zum Starten.');
}

async function processRecording(audioFilePath: string): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Verarbeite Sprachaufnahme...",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 30, message: "Transkribiere Audio..." });
        

        await delay(1500);
        
        progress.report({ increment: 30, message: "Generiere Kommentar..." });
        await delay(1000);
        

        const transcribedText = `Diese Funktion verarbeitet die Audio-Datei: ${audioFilePath}`;
        
        progress.report({ increment: 40, message: "Füge Kommentar ein..." });
        await delay(500);
        

        await insertComment(transcribedText);
        
        return Promise.resolve();
    });
}


async function insertComment(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showWarningMessage('Kein aktiver Editor gefunden! Öffne eine Code-Datei.');
        return;
    }
    
    const position = editor.selection.active;
    const languageId = editor.document.languageId;
    

    let comment = '';
    if (languageId === 'javascript' || languageId === 'typescript' || languageId === 'java' || languageId === 'csharp' || languageId === 'cpp') {

        comment = `/**\n * ${text}\n * @generated by Voice Doc on ${new Date().toLocaleString()}\n */`;
    } else if (languageId === 'python') {

        comment = `"""\n${text}\nGenerated by Voice Doc on ${new Date().toLocaleString()}\n"""`;
    } else if (languageId === 'html' || languageId === 'xml') {

        comment = `<!-- ${text} (Voice Doc: ${new Date().toLocaleString()}) -->`;
    } else {

        comment = `// ${text}`;
    }
    
    await editor.edit(editBuilder => {
        editBuilder.insert(position, comment + '\n');
    });
    
    vscode.window.showInformationMessage('✅ Kommentar wurde eingefügt!');
}


function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function deactivate() {
    if (audioRecorder) {
        audioRecorder.cleanup();
    }
    console.log('Voice Documentation Plugin wurde deaktiviert');
}