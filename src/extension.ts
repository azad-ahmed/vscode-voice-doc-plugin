import * as vscode from 'vscode';


export function activate(context: vscode.ExtensionContext) {
    console.log('Voice Documentation Plugin ist jetzt aktiv!');
    

    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        100
    );
    statusBarItem.text = "$(mic) Voice Doc";
    statusBarItem.tooltip = "Klicken für Sprachaufnahme";
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
            
            isRecording = true;
            statusBarItem.text = "$(stop-circle) Recording...";
            statusBarItem.command = 'voiceDoc.stopRecording';
            
            vscode.window.showInformationMessage('🎤 Sprachaufnahme gestartet! Sprechen Sie Ihren Kommentar...');
            
            
            console.log('Audio-Aufnahme würde jetzt starten...');
        }
    );
    
    const stopRecordingCommand = vscode.commands.registerCommand(
        'voiceDoc.stopRecording', 
        async () => {
            if (!isRecording) {
                return;
            }
            
            isRecording = false;
            statusBarItem.text = "$(mic) Voice Doc";
            statusBarItem.command = 'voiceDoc.startRecording';
            
            vscode.window.showInformationMessage('⏹️ Aufnahme beendet! Verarbeite Audio...');
            
            
            await processRecording();
        }
    );
    
    
    const configureCommand = vscode.commands.registerCommand(
        'voiceDoc.configure', 
        () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'voiceDoc');
        }
    );
    
    
    context.subscriptions.push(
        startRecordingCommand,
        stopRecordingCommand,
        configureCommand,
        statusBarItem
    );
}


async function processRecording(): Promise<void> {
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Verarbeite Sprachaufnahme...",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 30, message: "Transkribiere Audio..." });
        await delay(1000);
        
        progress.report({ increment: 30, message: "Generiere Kommentar..." });
        await delay(1000);
        
        progress.report({ increment: 40, message: "Füge Kommentar ein..." });
        await delay(500);
        
        
        await insertComment();
        
        return Promise.resolve();
    });
}


async function insertComment(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showWarningMessage('Kein aktiver Editor gefunden!');
        return;
    }
    
    const position = editor.selection.active;
    const simulatedComment = `// TODO: Hier wird später der transkribierte Kommentar eingefügt\n// Diese Funktion wurde am ${new Date().toLocaleString()} dokumentiert`;
    
    await editor.edit(editBuilder => {
        editBuilder.insert(position, simulatedComment + '\n');
    });
    
    vscode.window.showInformationMessage('✅ Kommentar wurde eingefügt!');
}


function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function deactivate() {
    console.log('Voice Documentation Plugin wurde deaktiviert');
}