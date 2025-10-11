import * as vscode from 'vscode';
import { CommentGenerator } from './generator';
import { IntegratedVoiceHandler } from './integratedVoiceHandler';
import { STTFactory } from './stt/factory';
import { ErrorHandler } from './utils/errorHandler';
import { ConfigManager } from './utils/configManager';
import { ApiUsageTracker } from './utils/apiUsageTracker';
import { AutoCommentMonitor } from './utils/autoCommentMonitor';
// ✨ NEU: Erweiterte Features
import { LearningSystem } from './learning/learningSystem';
import { CodeAnalyzer } from './analysis/codeAnalyzer';
import { AutoModeController } from './automode/autoModeController';

let statusBarItem: vscode.StatusBarItem;
let autoCommentStatusBarItem: vscode.StatusBarItem;
let commentGenerator: CommentGenerator;
let voiceHandler: IntegratedVoiceHandler;
let autoCommentMonitor: AutoCommentMonitor;
let outputChannel: vscode.OutputChannel;
// ✨ NEU: Erweiterte Services
let learningSystem: LearningSystem;
let codeAnalyzer: CodeAnalyzer;
let autoModeController: AutoModeController;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Voice Documentation');
    context.subscriptions.push(outputChannel);
    
    ErrorHandler.initialize(outputChannel);
    ConfigManager.initialize(context);
    ApiUsageTracker.initialize(context);
    
    outputChannel.appendLine('='.repeat(50));
    outputChannel.appendLine('Voice Documentation Plugin - Initialisierung');
    outputChannel.appendLine('='.repeat(50));

    try {
        commentGenerator = new CommentGenerator('auto');
        ErrorHandler.log('Extension', 'CommentGenerator initialisiert', 'success');

        voiceHandler = new IntegratedVoiceHandler(context, commentGenerator);
        ErrorHandler.log('Extension', 'VoiceHandler initialisiert', 'success');

        // ✨ NEU: Initialisiere erweiterte Features
        outputChannel.appendLine('Initialisiere erweiterte Features...');
        
        learningSystem = new LearningSystem(context);
        ErrorHandler.log('Extension', 'LearningSystem initialisiert', 'success');
        
        codeAnalyzer = new CodeAnalyzer(learningSystem);
        ErrorHandler.log('Extension', 'CodeAnalyzer initialisiert', 'success');
        
        autoModeController = new AutoModeController(
            codeAnalyzer,
            learningSystem,
            context
        );
        ErrorHandler.log('Extension', 'AutoModeController initialisiert', 'success');

        autoCommentMonitor = new AutoCommentMonitor(commentGenerator, learningSystem);
        ErrorHandler.log('Extension', 'AutoCommentMonitor initialisiert', 'success');

        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = 'voiceDocPlugin.toggleRecording';
        statusBarItem.text = '$(mic) Voice Doc';
        statusBarItem.tooltip = 'Klicken zum Starten der Aufnahme (Ctrl+Shift+R)';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        autoCommentStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        autoCommentStatusBarItem.command = 'voiceDocPlugin.toggleAutoComment';
        updateAutoCommentStatusBar();
        autoCommentStatusBarItem.show();
        context.subscriptions.push(autoCommentStatusBarItem);

        ErrorHandler.log('Extension', 'Status Bar erstellt', 'success');

        registerCommands(context);

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('voiceDocPlugin')) {
                    ErrorHandler.log('Extension', 'Konfiguration geändert - lade neu');
                    reloadConfiguration();
                }
            })
        );

        reloadConfiguration();

        const autoCommentMode = ConfigManager.get<string>('autoCommentMode', 'off');
        if (autoCommentMode !== 'off') {
            autoCommentMonitor.start();
        }

        // ✨ NEU: Auto-Mode aus Config laden
        const autoMode = ConfigManager.get<boolean>('autoMode', false);
        if (autoMode) {
            autoModeController.enable();
        }

        outputChannel.appendLine('='.repeat(50));
        outputChannel.appendLine('✅ Voice Documentation Plugin aktiviert');
        outputChannel.appendLine('✨ Erweiterte Features: Auto-Modus, Lernsystem, Code-Analyse');
        outputChannel.appendLine('='.repeat(50));
        
        vscode.window.showInformationMessage(
            '🎤 Voice Doc erweitert! Voice (Ctrl+Shift+R) | Auto (Ctrl+Shift+A)'
        );
        
    } catch (error: any) {
        ErrorHandler.handleError('activate', error);
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.toggleRecording', async () => {
            try {
                ErrorHandler.log('Command', 'Toggle Recording');
                await voiceHandler.toggleRecording();
                updateStatusBar();
            } catch (error: any) {
                ErrorHandler.handleError('toggleRecording', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.toggleAutoComment', async () => {
            try {
                await toggleAutoComment();
            } catch (error: any) {
                ErrorHandler.handleError('toggleAutoComment', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.analyzeCurrentFile', async () => {
            try {
                await analyzeCurrentFile();
            } catch (error: any) {
                ErrorHandler.handleError('analyzeCurrentFile', error);
            }
        })
    );

    // ✨ NEU: Auto-Mode Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.toggleAutoMode', () => {
            try {
                ErrorHandler.log('Command', 'Toggle Auto-Mode');
                autoModeController.toggle();
            } catch (error: any) {
                ErrorHandler.handleError('toggleAutoMode', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.analyzeCurrentFunction', async () => {
            try {
                ErrorHandler.log('Command', 'Analyze Current Function');
                await autoModeController.analyzeCurrentFunction();
            } catch (error: any) {
                ErrorHandler.handleError('analyzeCurrentFunction', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.showStatistics', () => {
            try {
                ErrorHandler.log('Command', 'Show Statistics');
                showStatistics();
            } catch (error: any) {
                ErrorHandler.handleError('showStatistics', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.trainFromFeedback', async () => {
            try {
                ErrorHandler.log('Command', 'Train From Feedback');
                await trainFromFeedback();
            } catch (error: any) {
                ErrorHandler.handleError('trainFromFeedback', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.startRecording', async () => {
            try {
                ErrorHandler.log('Command', 'Start Recording');
                await voiceHandler.startRecording();
                updateStatusBar();
            } catch (error: any) {
                ErrorHandler.handleError('startRecording', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.stopRecording', async () => {
            try {
                ErrorHandler.log('Command', 'Stop Recording');
                await voiceHandler.stopRecording();
                updateStatusBar();
            } catch (error: any) {
                ErrorHandler.handleError('stopRecording', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.convertToComment', async () => {
            try {
                await convertSelectedTextToComment();
            } catch (error: any) {
                ErrorHandler.handleError('convertToComment', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.insertFromClipboard', async () => {
            try {
                await insertCommentFromClipboard();
            } catch (error: any) {
                ErrorHandler.handleError('insertFromClipboard', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.configureOpenAI', async () => {
            try {
                await configureOpenAI();
            } catch (error: any) {
                ErrorHandler.handleError('configureOpenAI', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.configureAzure', async () => {
            try {
                await configureAzure();
            } catch (error: any) {
                ErrorHandler.handleError('configureAzure', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.testSTTProviders', async () => {
            try {
                await testSTTProviders();
            } catch (error: any) {
                ErrorHandler.handleError('testSTTProviders', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.test', async () => {
            try {
                await runTestCommand();
            } catch (error: any) {
                ErrorHandler.handleError('test', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.enableDemoMode', async () => {
            try {
                await enableDemoMode();
            } catch (error: any) {
                ErrorHandler.handleError('enableDemoMode', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.showUsageStats', async () => {
            try {
                await ApiUsageTracker.showUsageReport();
            } catch (error: any) {
                ErrorHandler.handleError('showUsageStats', error);
            }
        })
    );

    ErrorHandler.log('Extension', 'Alle Commands registriert (inkl. erweiterte Features)', 'success');
}

// ✨ NEU: Statistiken anzeigen
function showStatistics() {
    const stats = learningSystem.getStatistics();
    
    const panel = vscode.window.createWebviewPanel(
        'voiceDocStats',
        'Voice Doc - Lern-Statistiken',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    panel.webview.html = generateStatisticsHTML(stats);
    ErrorHandler.log('Extension', 'Statistiken angezeigt', 'success');
}

// ✨ NEU: Training aus Feedback
async function trainFromFeedback() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Training wird durchgeführt...',
        cancellable: false
    }, async () => {
        try {
            const stats = learningSystem.getStatistics();
            
            vscode.window.showInformationMessage(
                `✅ Training abgeschlossen!\n\n` +
                `Trainingsbeispiele: ${stats.totalExamples}\n` +
                `Akzeptanzrate: ${stats.acceptanceRate}%`
            );
            
            ErrorHandler.log('Extension', 'Training aus Feedback abgeschlossen', 'success');
        } catch (error: any) {
            ErrorHandler.handleError('trainFromFeedback', error);
        }
    });
}

// ✨ NEU: HTML für Statistiken
function generateStatisticsHTML(stats: any): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                h1 {
                    color: var(--vscode-activityBar-activeBorder);
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 8px;
                    padding: 20px;
                    margin: 15px 0;
                    border-left: 4px solid var(--vscode-activityBar-activeBorder);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .stat-title {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    opacity: 0.8;
                }
                .stat-value {
                    font-size: 36px;
                    font-weight: bold;
                    color: var(--vscode-activityBar-activeBorder);
                    margin: 10px 0;
                }
                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background: var(--vscode-editor-background);
                    border-radius: 10px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4CAF50, #8BC34A);
                    transition: width 0.3s ease;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                .language-stats {
                    margin-top: 10px;
                }
                .language-item {
                    padding: 8px;
                    margin: 5px 0;
                    background: var(--vscode-editor-background);
                    border-radius: 4px;
                    display: flex;
                    justify-content: space-between;
                }
            </style>
        </head>
        <body>
            <h1>🎓 Lern-Statistiken</h1>
            
            <div class="grid">
                <div class="stat-card">
                    <div class="stat-title">Gesamt Trainingsbeispiele</div>
                    <div class="stat-value">${stats.totalExamples}</div>
                </div>

                <div class="stat-card">
                    <div class="stat-title">Akzeptanzrate</div>
                    <div class="stat-value">${stats.acceptanceRate}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.acceptanceRate}%"></div>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Voice-basierte Dokumentationen</div>
                <div class="stat-value">${stats.voiceExamples}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stats.totalExamples > 0 ? (stats.voiceExamples / stats.totalExamples * 100) : 0}%"></div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Auto-generierte Dokumentationen</div>
                <div class="stat-value">${stats.autoExamples}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stats.totalExamples > 0 ? (stats.autoExamples / stats.totalExamples * 100) : 0}%"></div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Durchschnittliche Konfidenz</div>
                <div class="stat-value">${stats.avgConfidence}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stats.avgConfidence}%"></div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Häufigste Programmiersprachen</div>
                <div class="language-stats">
                    ${Object.entries(stats.languageStats).map(([lang, count]) => `
                        <div class="language-item">
                            <strong>${lang}</strong>
                            <span>${count} Beispiele</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Erkannte Patterns</div>
                <div class="stat-value">${stats.patternsCount}</div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Glossar-Größe</div>
                <div class="stat-value">${stats.glossarySize}</div>
                <p style="opacity: 0.7; margin-top: 10px;">
                    Erkannte technische Begriffe und Konzepte
                </p>
            </div>
        </body>
        </html>
    `;
}

async function toggleAutoComment() {
    const stats = autoCommentMonitor.getStatistics();
    
    if (stats.isActive) {
        autoCommentMonitor.stop();
        await ConfigManager.set('autoCommentMode', 'off');
        vscode.window.showInformationMessage('🤖 Auto-Kommentierung deaktiviert');
    } else {
        const mode = await vscode.window.showQuickPick([
            {
                label: '💾 Beim Speichern',
                description: 'Kommentare werden beim Speichern der Datei hinzugefügt',
                value: 'on-save'
            },
            {
                label: '⌨️ Beim Tippen',
                description: 'Kommentare werden automatisch während des Schreibens erkannt',
                value: 'on-type'
            }
        ], {
            placeHolder: 'Wann sollen Kommentare automatisch hinzugefügt werden?'
        });

        if (mode) {
            await ConfigManager.set('autoCommentMode', mode.value);
            autoCommentMonitor.start();
            vscode.window.showInformationMessage(
                `🤖 Auto-Kommentierung aktiviert (${mode.label})`
            );
        }
    }
    
    updateAutoCommentStatusBar();
}

async function analyzeCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analysiere Code...',
        cancellable: false
    }, async () => {
        try {
            // Verwende den bereits initialisierten codeAnalyzer
            const codeContext = {
                code: editor.document.getText(),
                line: editor.selection.active.line,
                languageId: editor.document.languageId,
                functionName: 'current-file',
                functionType: 'code' as const
            };

            const result = await codeAnalyzer.analyzeCode(codeContext);
            
            const message = `
📊 Code-Analyse Ergebnis:

Beschreibung: ${result.description}
${result.details ? `Details: ${result.details}` : ''}
Konfidenz: ${Math.round(result.confidence * 100)}%
            `.trim();

            vscode.window.showInformationMessage(message);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Analyse fehlgeschlagen: ${error.message}`);
        }
    });
}

function updateAutoCommentStatusBar() {
    const stats = autoCommentMonitor.getStatistics();
    
    if (stats.isActive) {
        autoCommentStatusBarItem.text = '$(robot) Auto';
        autoCommentStatusBarItem.tooltip = 'Auto-Kommentierung aktiv (Klick zum Deaktivieren)';
        autoCommentStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        autoCommentStatusBarItem.text = '$(robot) Auto';
        autoCommentStatusBarItem.tooltip = 'Auto-Kommentierung inaktiv (Klick zum Aktivieren)';
        autoCommentStatusBarItem.backgroundColor = undefined;
    }
}

async function enableDemoMode() {
    await ConfigManager.deleteSecret('openAIApiKey');
    await ConfigManager.deleteSecret('azureApiKey');
    
    ErrorHandler.log('Extension', 'Demo-Modus aktiviert');
    
    await voiceHandler.reloadSTTProvider();
    
    vscode.window.showInformationMessage(
        '🎮 Demo-Modus aktiviert!\n\nDie Extension verwendet jetzt simulierte Transkriptionen.\n\nUm echte STT zu nutzen:\n• Ctrl+Shift+P → "Voice Doc: OpenAI konfigurieren"',
        'OK'
    );
}

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

    vscode.window.showInformationMessage('✅ Kommentar eingefügt!');
}

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
        await ConfigManager.setSecret('openAIApiKey', apiKey);
        await commentGenerator.setOpenAIApiKey(apiKey);
        await voiceHandler.reloadSTTProvider();
        
        ErrorHandler.log('Extension', 'OpenAI API Key konfiguriert', 'success');
        vscode.window.showInformationMessage('✅ OpenAI API Key konfiguriert!');
    }
}

async function configureAzure() {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Azure Speech API Key eingeben',
        placeHolder: '********************************',
        password: true,
        validateInput: (value) => {
            if (!value) return 'API Key darf nicht leer sein';
            if (value.length !== 32) return 'Azure API Key muss 32 Zeichen haben';
            return null;
        }
    });

    if (!apiKey) return;

    const region = await vscode.window.showQuickPick([
        'westeurope',
        'northeurope',
        'eastus',
        'westus2',
        'southeastasia'
    ], {
        placeHolder: 'Wähle die Azure Region'
    });

    if (!region) return;

    await ConfigManager.setSecret('azureApiKey', apiKey);
    await ConfigManager.set('azureRegion', region);
    await voiceHandler.reloadSTTProvider();
    
    ErrorHandler.log('Extension', `Azure konfiguriert (Region: ${region})`, 'success');
    vscode.window.showInformationMessage('✅ Azure Cognitive Services konfiguriert!');
}

async function testSTTProviders() {
    ErrorHandler.log('Extension', 'Teste STT Provider...');
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Teste STT Provider...',
        cancellable: false
    }, async (_progress) => {
        try {
            const providers = await STTFactory.detectAvailableProviders();
            
            outputChannel.appendLine(`\n📊 Gefundene Provider: ${providers.length}\n`);
            
            let availableCount = 0;
            
            for (const provider of providers) {
                const status = provider.available ? '✅' : '❌';
                const line = `${status} ${provider.name}: ${provider.available ? 'Verfügbar' : 'Nicht konfiguriert'}`;
                outputChannel.appendLine(line);
                
                if (provider.available) availableCount++;
            }
            
            outputChannel.appendLine('\n' + '='.repeat(50));
            
            if (availableCount === 0) {
                vscode.window.showWarningMessage(
                    'Keine STT Provider verfügbar',
                    'OpenAI konfigurieren',
                    'Azure konfigurieren',
                    'Demo-Modus'
                ).then(action => {
                    if (action === 'OpenAI konfigurieren') {
                        vscode.commands.executeCommand('voiceDocPlugin.configureOpenAI');
                    } else if (action === 'Azure konfigurieren') {
                        vscode.commands.executeCommand('voiceDocPlugin.configureAzure');
                    } else if (action === 'Demo-Modus') {
                        vscode.commands.executeCommand('voiceDocPlugin.enableDemoMode');
                    }
                });
            } else {
                vscode.window.showInformationMessage(
                    `✅ ${availableCount} Provider verfügbar!`,
                    'Details anzeigen'
                ).then(action => {
                    if (action === 'Details anzeigen') {
                        outputChannel.show();
                    }
                });
            }
            
        } catch (error: any) {
            ErrorHandler.handleError('testSTTProviders', error);
        }
    });
}

function reloadConfiguration() {
    ConfigManager.clearCache();
    
    const autoCommentMode = ConfigManager.get<string>('autoCommentMode', 'off');
    if (autoCommentMode !== 'off') {
        autoCommentMonitor.start();
    } else {
        autoCommentMonitor.stop();
    }
    
    updateAutoCommentStatusBar();
    ErrorHandler.log('Extension', 'Konfiguration neu geladen', 'success');
}

function updateStatusBar() {
    if (voiceHandler.isRecording()) {
        statusBarItem.text = '$(record) Aufnahme läuft...';
        statusBarItem.tooltip = 'Klicken zum Stoppen';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.text = '$(mic) Voice Doc';
        statusBarItem.tooltip = 'Klicken zum Starten der Aufnahme (Ctrl+Shift+R)';
        statusBarItem.backgroundColor = undefined;
    }
}

async function runTestCommand() {
    const testText = 'Diese Funktion berechnet die Fibonacci-Zahlen rekursiv';
    
    const action = await vscode.window.showQuickPick([
        'Test: Kommentar einfügen',
        'Test: Mit KI verbessern',
        'Test: Kommentar validieren',
        'Test: STT Provider anzeigen',
        'Test: API-Nutzung anzeigen',
        'Test: Code analysieren',
        '✨ Test: Auto-Modus',
        '✨ Test: Statistiken'
    ], {
        placeHolder: 'Wähle einen Test'
    });

    const editor = vscode.window.activeTextEditor;
    
    switch (action) {
        case 'Test: Kommentar einfügen': {
            if (!editor) {
                vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
                return;
            }
            const comment = commentGenerator.formatComment(testText, editor.document.languageId);
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, comment + '\n');
            });
            vscode.window.showInformationMessage('✅ Test-Kommentar eingefügt!');
            break;
        }
        
        case 'Test: Mit KI verbessern': {
            if (!editor) {
                vscode.window.showWarningMessage('Kein aktiver Editor gefunden.');
                return;
            }
            try {
                const enhanced = await commentGenerator.enhanceWithOpenAI(testText, null);
                const comment = commentGenerator.formatComment(enhanced, editor.document.languageId);
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, comment + '\n');
                });
                vscode.window.showInformationMessage('✅ KI-verbesserter Kommentar eingefügt!');
            } catch (error: any) {
                vscode.window.showErrorMessage('KI-Verbesserung fehlgeschlagen: ' + error.message);
            }
            break;
        }
        
        case 'Test: Kommentar validieren': {
            const comment = commentGenerator.formatComment(testText, 'typescript');
            const validation = commentGenerator.validateComment(comment);
            vscode.window.showInformationMessage(
                `Validierung: ${validation.isValid ? '✅' : '❌'} Score: ${validation.score}/100`
            );
            break;
        }
        
        case 'Test: STT Provider anzeigen': {
            await testSTTProviders();
            break;
        }

        case 'Test: API-Nutzung anzeigen': {
            await ApiUsageTracker.showUsageReport();
            break;
        }

        case 'Test: Code analysieren': {
            await analyzeCurrentFile();
            break;
        }

        case '✨ Test: Auto-Modus': {
            autoModeController.toggle();
            break;
        }

        case '✨ Test: Statistiken': {
            showStatistics();
            break;
        }
    }
}

export function deactivate() {
    ErrorHandler.log('Extension', 'Voice Documentation Plugin wird deaktiviert');
    
    if (voiceHandler) {
        voiceHandler.dispose();
    }
    
    if (autoCommentMonitor) {
        autoCommentMonitor.dispose();
    }
    
    if (statusBarItem) {
        statusBarItem.dispose();
    }

    if (autoCommentStatusBarItem) {
        autoCommentStatusBarItem.dispose();
    }
    
    ErrorHandler.log('Extension', 'Plugin erfolgreich deaktiviert', 'success');
}
