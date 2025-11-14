import * as vscode from 'vscode';
import { ConfigManager } from '../utils/configManager';
import { ErrorHandler } from '../utils/errorHandler';
import { OpenAIWhisperProvider } from '../stt/openAIProvider';
import { AzureSTTProvider } from '../stt/azureProvider';

/**
 * Verwaltet das Onboarding neuer Benutzer
 */
export class OnboardingManager {
    private static readonly ONBOARDING_KEY = 'voiceDoc.hasCompletedOnboarding';
    private static readonly VERSION_KEY = 'voiceDoc.onboardingVersion';
    private static readonly CURRENT_VERSION = '1.0.0';

    /**
     * Prüft ob Onboarding nötig ist und führt es aus
     */
    static async checkAndRunOnboarding(context: vscode.ExtensionContext): Promise<boolean> {
        const hasCompleted = context.globalState.get<boolean>(this.ONBOARDING_KEY, false);
        const lastVersion = context.globalState.get<string>(this.VERSION_KEY, '0.0.0');

        // Prüfe ob es der erste Start ist ODER eine neue Version
        if (!hasCompleted || lastVersion !== this.CURRENT_VERSION) {
            ErrorHandler.log('Onboarding', '🎉 Starte Willkommens-Dialog');
            const completed = await this.runOnboarding(context);
            
            if (completed) {
                await context.globalState.update(this.ONBOARDING_KEY, true);
                await context.globalState.update(this.VERSION_KEY, this.CURRENT_VERSION);
                return true;
            }
            return false;
        }

        return false;
    }

    /**
     * Führt den kompletten Onboarding-Prozess durch
     */
    private static async runOnboarding(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            // Schritt 1: Willkommens-Nachricht
            await this.showWelcomeMessage();

            // Schritt 2: Provider-Auswahl
            const provider = await this.selectProvider();
            
            if (!provider) {
                ErrorHandler.log('Onboarding', 'Abgebrochen - kein Provider gewählt');
                return false;
            }

            // Schritt 3: Provider konfigurieren und testen
            const success = await this.configureAndTestProvider(provider, context);

            if (success) {
                // Schritt 4: Erfolgs-Nachricht mit Quick-Start-Tipps
                await this.showSuccessMessage(provider);
                return true;
            } else {
                ErrorHandler.log('Onboarding', 'Konfiguration fehlgeschlagen oder abgebrochen');
                return false;
            }

        } catch (error: any) {
            ErrorHandler.handleError('Onboarding', error);
            return false;
        }
    }

    /**
     * Zeigt eine schöne Willkommens-Nachricht
     */
    private static async showWelcomeMessage(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'voiceDocWelcome',
            '🎤 Willkommen bei Voice Documentation!',
            vscode.ViewColumn.One,
            {
                enableScripts: false
            }
        );

        panel.webview.html = this.getWelcomeHTML();

        // Warte 3 Sekunden, damit User die Message lesen kann
        await new Promise(resolve => setTimeout(resolve, 3000));
        panel.dispose();
    }

    /**
     * HTML für Willkommens-Nachricht
     */
    private static getWelcomeHTML(): string {
        return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        h1 {
            font-size: 48px;
            margin-bottom: 20px;
            animation: fadeIn 1s ease-in;
        }
        .subtitle {
            font-size: 24px;
            opacity: 0.9;
            margin-bottom: 40px;
            animation: fadeIn 1.5s ease-in;
        }
        .features {
            text-align: left;
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            animation: slideUp 1s ease-out;
        }
        .feature {
            margin: 15px 0;
            font-size: 18px;
            display: flex;
            align-items: center;
        }
        .feature-icon {
            font-size: 24px;
            margin-right: 15px;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translateY(30px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎤 Willkommen!</h1>
        <div class="subtitle">
            Voice Documentation für VS Code
        </div>
        <div class="features">
            <div class="feature">
                <span class="feature-icon">🎙️</span>
                <span>Dokumentiere deinen Code per Spracheingabe</span>
            </div>
            <div class="feature">
                <span class="feature-icon">🤖</span>
                <span>KI-gestützte Kommentar-Generierung</span>
            </div>
            <div class="feature">
                <span class="feature-icon">👁️</span>
                <span>Automatische Code-Analyse</span>
            </div>
            <div class="feature">
                <span class="feature-icon">🎓</span>
                <span>Lernendes System, das sich anpasst</span>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Lässt User den STT-Provider auswählen
     */
    private static async selectProvider(): Promise<string | undefined> {
        const items: vscode.QuickPickItem[] = [
            {
                label: '$(rocket) OpenAI Whisper',
                description: 'Empfohlen - Beste Qualität',
                detail: 'Nutzt OpenAI Whisper API für präzise Spracherkennung (API-Key erforderlich)'
            },
            {
                label: '$(cloud) Azure Cognitive Services',
                description: 'Enterprise-Lösung',
                detail: 'Microsoft Azure Speech-to-Text (API-Key + Region erforderlich)'
            },
            {
                label: '$(beaker) Demo-Modus',
                description: 'Testen ohne API-Keys',
                detail: 'Simulierte Transkriptionen - perfekt zum Ausprobieren der Features'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '🎯 Wie möchtest du Voice Doc nutzen?',
            title: 'Speech-to-Text Provider auswählen',
            ignoreFocusOut: true
        });

        if (!selected) {
            return undefined;
        }

        // Mappe Label zu Provider-Namen
        if (selected.label.includes('OpenAI')) {
            return 'openai';
        } else if (selected.label.includes('Azure')) {
            return 'azure';
        } else if (selected.label.includes('Demo')) {
            return 'demo';
        }

        return undefined;
    }

    /**
     * Konfiguriert und testet den gewählten Provider
     */
    private static async configureAndTestProvider(
        provider: string,
        context: vscode.ExtensionContext
    ): Promise<boolean> {
        if (provider === 'demo') {
            return await this.setupDemoMode(context);
        } else if (provider === 'openai') {
            return await this.setupOpenAI(context);
        } else if (provider === 'azure') {
            return await this.setupAzure(context);
        }

        return false;
    }

    /**
     * Richtet Demo-Modus ein
     */
    private static async setupDemoMode(context: vscode.ExtensionContext): Promise<boolean> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🎮 Demo-Modus wird aktiviert...',
            cancellable: false
        }, async () => {
            // Stelle sicher, dass keine API-Keys gesetzt sind
            await ConfigManager.deleteSecret('openAIApiKey');
            await ConfigManager.deleteSecret('azureApiKey');
            await ConfigManager.set('sttProvider', 'auto');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        });

        ErrorHandler.log('Onboarding', 'Demo-Modus aktiviert', 'success');
        return true;
    }

    /**
     * Richtet OpenAI ein und testet die Verbindung
     */
    private static async setupOpenAI(context: vscode.ExtensionContext): Promise<boolean> {
        // API-Key abfragen
        const apiKey = await vscode.window.showInputBox({
            prompt: '🔑 OpenAI API Key eingeben',
            placeHolder: 'sk-...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value) {
                    return 'API-Key darf nicht leer sein';
                }
                if (!value.startsWith('sk-')) {
                    return 'OpenAI API-Keys beginnen mit "sk-"';
                }
                if (value.length < 20) {
                    return 'API-Key erscheint zu kurz';
                }
                return null;
            }
        });

        if (!apiKey) {
            return false;
        }

        // Teste Verbindung
        const success = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🔄 Teste OpenAI-Verbindung...',
            cancellable: false
        }, async () => {
            try {
                // Erstelle Test-Provider
                const provider = new OpenAIWhisperProvider(apiKey);
                
                // Prüfe ob Provider verfügbar ist
                const isAvailable = await provider.isAvailable();
                
                if (!isAvailable) {
                    throw new Error('OpenAI API nicht erreichbar');
                }

                // Speichere API-Key sicher
                await ConfigManager.setSecret('openAIApiKey', apiKey);
                await ConfigManager.set('sttProvider', 'openai');

                ErrorHandler.log('Onboarding', 'OpenAI erfolgreich konfiguriert', 'success');
                return true;

            } catch (error: any) {
                ErrorHandler.handleError('Onboarding - OpenAI Test', error);
                
                const retry = await vscode.window.showErrorMessage(
                    `❌ Verbindung fehlgeschlagen: ${error.message}`,
                    'Erneut versuchen',
                    'Anderen Key eingeben',
                    'Abbrechen'
                );

                if (retry === 'Erneut versuchen') {
                    // Teste nochmal mit gleichem Key
                    return await this.setupOpenAI(context);
                } else if (retry === 'Anderen Key eingeben') {
                    // Neuen Key abfragen
                    return await this.setupOpenAI(context);
                }

                return false;
            }
        });

        return success;
    }

    /**
     * Richtet Azure ein und testet die Verbindung
     */
    private static async setupAzure(context: vscode.ExtensionContext): Promise<boolean> {
        // API-Key abfragen
        const apiKey = await vscode.window.showInputBox({
            prompt: '🔑 Azure Speech API Key eingeben',
            placeHolder: '********************************',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value) {
                    return 'API-Key darf nicht leer sein';
                }
                if (value.length !== 32) {
                    return 'Azure API-Keys haben genau 32 Zeichen';
                }
                return null;
            }
        });

        if (!apiKey) {
            return false;
        }

        // Region auswählen
        const regions = [
            { label: 'West Europe', value: 'westeurope', description: 'Empfohlen für Europa' },
            { label: 'North Europe', value: 'northeurope', description: 'Skandinavien' },
            { label: 'East US', value: 'eastus', description: 'USA Ostküste' },
            { label: 'West US 2', value: 'westus2', description: 'USA Westküste' },
            { label: 'Southeast Asia', value: 'southeastasia', description: 'Asien-Pazifik' }
        ];

        const selectedRegion = await vscode.window.showQuickPick(regions, {
            placeHolder: '🌍 Azure Region auswählen',
            ignoreFocusOut: true
        });

        if (!selectedRegion) {
            return false;
        }

        // Teste Verbindung
        const success = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🔄 Teste Azure-Verbindung...',
            cancellable: false
        }, async () => {
            try {
                // Erstelle Test-Provider
                const provider = new AzureSTTProvider(apiKey, selectedRegion.value);
                
                // Prüfe ob Provider verfügbar ist
                const isAvailable = await provider.isAvailable();
                
                if (!isAvailable) {
                    throw new Error('Azure Speech Service nicht erreichbar');
                }

                // Speichere Konfiguration
                await ConfigManager.setSecret('azureApiKey', apiKey);
                await ConfigManager.set('azureRegion', selectedRegion.value);
                await ConfigManager.set('sttProvider', 'azure');

                ErrorHandler.log('Onboarding', `Azure erfolgreich konfiguriert (${selectedRegion.value})`, 'success');
                return true;

            } catch (error: any) {
                ErrorHandler.handleError('Onboarding - Azure Test', error);
                
                const retry = await vscode.window.showErrorMessage(
                    `❌ Verbindung fehlgeschlagen: ${error.message}`,
                    'Erneut versuchen',
                    'Andere Konfiguration',
                    'Abbrechen'
                );

                if (retry === 'Erneut versuchen') {
                    // Teste nochmal mit gleicher Config
                    return await this.setupAzure(context);
                } else if (retry === 'Andere Konfiguration') {
                    // Neue Config abfragen
                    return await this.setupAzure(context);
                }

                return false;
            }
        });

        return success;
    }

    /**
     * Zeigt Erfolgs-Nachricht mit Quick-Start-Tipps
     */
    private static async showSuccessMessage(provider: string): Promise<void> {
        const providerName = 
            provider === 'openai' ? 'OpenAI Whisper' :
            provider === 'azure' ? 'Azure Cognitive Services' :
            'Demo-Modus';

        const message = `✅ Voice Doc ist einsatzbereit!\n\n` +
            `📡 Provider: ${providerName}\n\n` +
            `🎯 So geht's los:\n` +
            `  • Drücke Ctrl+Shift+R zum Aufnehmen\n` +
            `  • Sprich deine Code-Erklärung\n` +
            `  • Drücke nochmal Ctrl+Shift+R zum Stoppen\n` +
            `  • Der Kommentar wird automatisch eingefügt!\n\n` +
            `💡 Extra-Features:\n` +
            `  • Ctrl+Shift+A: Auto-Modus (überwacht Projekt)\n` +
            `  • Rechtsklick im Code: Voice Doc Optionen`;

        const action = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            'Los geht\'s!',
            'Tutorial zeigen'
        );

        if (action === 'Tutorial zeigen') {
            await this.showQuickTutorial();
        }

        ErrorHandler.log('Onboarding', '✅ Onboarding erfolgreich abgeschlossen', 'success');
    }

    /**
     * Zeigt ein kurzes Tutorial
     */
    private static async showQuickTutorial(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'voiceDocTutorial',
            '🎓 Voice Doc Tutorial',
            vscode.ViewColumn.One,
            {
                enableScripts: false
            }
        );

        panel.webview.html = this.getTutorialHTML();
    }

    /**
     * HTML für Tutorial
     */
    private static getTutorialHTML(): string {
        return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.6;
        }
        h1 {
            color: var(--vscode-activityBar-activeBorder);
            border-bottom: 2px solid var(--vscode-activityBar-activeBorder);
            padding-bottom: 10px;
        }
        .step {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid var(--vscode-activityBar-activeBorder);
        }
        .step-number {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-activityBar-activeBorder);
            margin-bottom: 10px;
        }
        .keyboard {
            background: var(--vscode-editor-background);
            padding: 5px 10px;
            border-radius: 4px;
            font-family: monospace;
            font-weight: bold;
            border: 1px solid var(--vscode-activityBar-activeBorder);
        }
        .tip {
            background: rgba(255, 200, 0, 0.1);
            border-left: 4px solid #ffc800;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .example {
            background: var(--vscode-editor-background);
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <h1>🎓 Voice Doc - Quick Start Tutorial</h1>
    
    <div class="step">
        <div class="step-number">1️⃣ Datei öffnen</div>
        <p>Öffne eine Code-Datei (TypeScript, JavaScript, Python, etc.)</p>
    </div>

    <div class="step">
        <div class="step-number">2️⃣ Position wählen</div>
        <p>Setze den Cursor über eine Funktion, Klasse oder Code-Block, den du dokumentieren möchtest</p>
    </div>

    <div class="step">
        <div class="step-number">3️⃣ Aufnahme starten</div>
        <p>Drücke <span class="keyboard">Ctrl+Shift+R</span> (Mac: Cmd+Shift+R)</p>
        <p>Oder klicke auf <span class="keyboard">🎤 Voice Doc</span> in der Status-Leiste unten</p>
    </div>

    <div class="step">
        <div class="step-number">4️⃣ Sprechen</div>
        <p>Erkläre deinen Code in eigenen Worten. Zum Beispiel:</p>
        <div class="example">
            "Diese Funktion berechnet die Fibonacci-Zahlen rekursiv.
            Sie nimmt eine Zahl n als Parameter und gibt die n-te
            Fibonacci-Zahl zurück."
        </div>
    </div>

    <div class="step">
        <div class="step-number">5️⃣ Aufnahme stoppen</div>
        <p>Drücke erneut <span class="keyboard">Ctrl+Shift+R</span></p>
        <p>Der Kommentar wird automatisch generiert und eingefügt!</p>
    </div>

    <div class="tip">
        <strong>💡 Pro-Tipp:</strong> Sprich natürlich und entspannt. Die KI verbessert
        automatisch die Formulierung und passt den Stil an deine Programmiersprache an!
    </div>

    <h2>🚀 Erweiterte Features</h2>

    <div class="step">
        <div class="step-number">👁️ Auto-Modus</div>
        <p>Drücke <span class="keyboard">Ctrl+Shift+A</span> um die automatische
        Code-Überwachung zu aktivieren. Das Plugin schlägt automatisch Kommentare
        für undokumentierten Code vor!</p>
    </div>

    <div class="step">
        <div class="step-number">📊 Statistiken</div>
        <p>Öffne die Command Palette (<span class="keyboard">Ctrl+Shift+P</span>)
        und suche nach "Voice Doc: Statistiken anzeigen" um deine Fortschritte zu sehen.</p>
    </div>

    <div class="tip">
        <strong>🎯 Viel Erfolg!</strong> Bei Fragen oder Problemen kannst du jederzeit
        die Command Palette öffnen und nach "Voice Doc" suchen, um alle verfügbaren
        Befehle zu sehen.
    </div>
</body>
</html>
        `;
    }

    /**
     * Ermöglicht manuelles Zurücksetzen des Onboardings (für Testing)
     */
    static async resetOnboarding(context: vscode.ExtensionContext): Promise<void> {
        await context.globalState.update(this.ONBOARDING_KEY, false);
        await context.globalState.update(this.VERSION_KEY, '0.0.0');
        ErrorHandler.log('Onboarding', 'Onboarding zurückgesetzt', 'success');
        vscode.window.showInformationMessage('✅ Onboarding wurde zurückgesetzt. Starte VS Code neu, um es erneut zu durchlaufen.');
    }
}
