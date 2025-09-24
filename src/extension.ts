import * as vscode from 'vscode';
import { CommentGenerator } from './generator';
import { IntegratedVoiceHandler } from './integratedVoiceHandler';

// Globale Variablen
let statusBarItem: vscode.StatusBarItem;
let commentGenerator: CommentGenerator;
let voiceHandler: IntegratedVoiceHandler;

/**
 * Aktiviert die Extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Voice Documentation Plugin wird aktiviert...');

    // Initialisiere Komponenten
    commentGenerator = new CommentGenerator('auto');
    voiceHandler = new IntegratedVoiceHandler(context, commentGenerator);

    // Status-Bar Item erstellen
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'voiceDocPlugin.toggleRecording';
    statusBarItem.text = '$(mic) Voice Doc';
    statusBarItem.tooltip = 'Klicken zum Starten der Aufnahme';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Registriere alle Befehle
    registerCommands(context);

    // Konfigurationsänderungen überwachen
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('voiceDocPlugin')) {
                reloadConfiguration();
            }
        })
    );

    // Initial-Konfiguration laden
    reloadConfiguration();

    vscode.window.showInformationMessage('Voice Documentation Plugin ist bereit! 🎤');
}

/**
 * Registriert alle Extension-Befehle
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Hauptbefehl: Aufnahme toggle
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.toggleRecording', async () => {
            await voiceHandler.toggleRecording();
            updateStatusBar();
        })
    );

    // Aufnahme starten
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.startRecording', async () => {
            await voiceHandler.startRecording();
            updateStatusBar();
        })
    );

    // Aufnahme stoppen
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.stopRecording', async () => {
            await voiceHandler.stopRecording();
            updateStatusBar();
        })
    );

    // Text zu Kommentar konvertieren
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.convertToComment', async () => {
            await convertSelectedTextToComment();
        })
    );

    // Kommentar aus Zwischenablage
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.insertFromClipboard', async () => {
            await insertCommentFromClipboard();
        })
    );

    // OpenAI konfigurieren
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.configureOpenAI', async () => {
            await configureOpenAI();
        })
    );

    // Test-Befehl
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.test', async () => {
            await runTestCommand();
        })
    );
}

/**
 * Konvertiert ausgewählten Text zu einem Kommentar
 */
async function convertSelectedTextToComment() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    
    if (!text) {
        vscode.window.showWarningMessage('Bitte wählen Sie Text aus.');
        return;
    }

    const languageId = editor.document.languageId;
    const comment = commentGenerator.formatComment(text, languageId);

    await editor.edit(editBuilder => {
        editBuilder.replace(selection, comment);
    });

    vscode.window.showInformationMessage('✅ Text zu Kommentar konvertiert!');
}

/**
 * Fügt Kommentar aus Zwischenablage ein
 */
async function insertCommentFromClipboard() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
        return;
    }

    const clipboardText = await vscode.env.clipboard.readText();
    
    if (!clipboardText) {
        vscode.window.showWarningMessage('Zwischenablage ist leer.');
        return;
    }

    const languageId = editor.document.languageId;
    const comment = commentGenerator.formatComment(clipboardText, languageId);

    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);
    const indentation = line.firstNonWhitespaceCharacterIndex;
    const indent = ' '.repeat(indentation);

    await editor.edit(editBuilder => {
        editBuilder.insert(
            new vscode.Position(position.line, 0),
            indent + comment + '\n'
        );
    });

    vscode.window.showInformationMessage('✅ Kommentar aus Zwischenablage eingefügt!');
}

/**
 * Konfiguriert OpenAI API Key
 */
async function configureOpenAI() {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'OpenAI API Key eingeben',
        placeHolder: 'sk-...',
        password: true,
        validateInput: (value) => {
            if (!value) return 'API Key darf nicht leer sein';
            if (!value.startsWith('sk-')) return 'API Key sollte mit "sk-" beginnen';
            return null;
        }
    });

    if (apiKey) {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        await config.update('openAIApiKey', apiKey, vscode.ConfigurationTarget.Global);
        commentGenerator.setOpenAIApiKey(apiKey);
        vscode.window.showInformationMessage('✅ OpenAI API Key konfiguriert!');
    }
}

/**
 * Lädt die Konfiguration neu
 */
function reloadConfiguration() {
    const config = vscode.workspace.getConfiguration('voiceDocPlugin');
    const apiKey = config.get<string>('openAIApiKey');
    
    if (apiKey) {
        commentGenerator.setOpenAIApiKey(apiKey);
    }
}

/**
 * Aktualisiert die Status-Bar
 */
function updateStatusBar() {
    if (voiceHandler.isRecording()) {
        statusBarItem.text = '$(record) Aufnahme läuft...';
        statusBarItem.tooltip = 'Klicken zum Stoppen';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.text = '$(mic) Voice Doc';
        statusBarItem.tooltip = 'Klicken zum Starten der Aufnahme';
        statusBarItem.backgroundColor = undefined;
    }
}

/**
 * Test-Befehl
 */
async function runTestCommand() {
    const testText = 'Diese Funktion berechnet die Fibonacci-Zahlen rekursiv';
    
    const action = await vscode.window.showQuickPick([
        'Test: Kommentar einfügen',
        'Test: Mit KI verbessern',
        'Test: Kommentar validieren'
    ]);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
        return;
    }

    switch (action) {
        case 'Test: Kommentar einfügen': {
            const comment = commentGenerator.formatComment(testText, editor.document.languageId);
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, comment + '\n');
            });
            break;
        }
        case 'Test: Mit KI verbessern': {
            try {
                const enhanced = await commentGenerator.enhanceWithOpenAI(testText, null);
                const comment = commentGenerator.formatComment(enhanced, editor.document.languageId);
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, comment + '\n');
                });
            } catch (error) {
                vscode.window.showErrorMessage('KI-Verbesserung fehlgeschlagen: ' + error);
            }
            break;
        }
        case 'Test: Kommentar validieren': {
            const comment = commentGenerator.formatComment(testText, editor.document.languageId);
            const validation = commentGenerator.validateComment(comment);
            vscode.window.showInformationMessage(
                `Validierung: ${validation.isValid ? '✅' : '❌'} Score: ${validation.score}`
            );
            break;
        }
    }
}

/**
 * Deaktiviert die Extension
 */
export function deactivate() {
    if (voiceHandler) {
        voiceHandler.dispose();
    }
    
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    
    console.log('Voice Documentation Plugin wurde deaktiviert');
}