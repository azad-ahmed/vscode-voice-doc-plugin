import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { ErrorHandler } from './errorHandler';

/**
 * Verwaltet den automatischen Demo-Modus für einfachen Einstieg
 * Vereinfachte Version für schnelle Integration
 */
export class AutoDemoManager {
    private static readonly FIRST_RUN_KEY = 'voiceDocPlugin.hasRunBefore';
    private static readonly DEMO_MODE_KEY = 'voiceDocPlugin.demoModeActive';

    /**
     * Prüft ob dies der erste Start ist und aktiviert Demo-Modus falls nötig
     */
    public static async checkAndInitialize(context: vscode.ExtensionContext): Promise<void> {
        const hasRunBefore = context.globalState.get<boolean>(this.FIRST_RUN_KEY, false);

        if (!hasRunBefore) {
            ErrorHandler.log('AutoDemo', '🎮 Erster Start erkannt - aktiviere Demo-Modus');
            await this.showWelcomeAndSetupDemo(context);
            await context.globalState.update(this.FIRST_RUN_KEY, true);
        }
    }

    /**
     * Zeigt Welcome-Screen und richtet Demo-Modus ein
     */
    private static async showWelcomeAndSetupDemo(context: vscode.ExtensionContext): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            '🎤 Willkommen beim Voice Documentation Plugin!\n\n' +
            '• **Demo-Modus**: Sofort loslegen ohne API-Keys\n' +
            '• **OpenAI**: Beste Qualität mit OpenAI Whisper\n' +
            '• **Azure**: Enterprise-Lösung',
            { modal: true },
            '🎮 Demo-Modus',
            '🔑 OpenAI',
            '☁️ Azure'
        );

        if (choice === '🎮 Demo-Modus') {
            await this.enableDemoMode(context);
        } else if (choice === '🔑 OpenAI') {
            await vscode.commands.executeCommand('voiceDocPlugin.configureOpenAI');
        } else if (choice === '☁️ Azure') {
            await vscode.commands.executeCommand('voiceDocPlugin.configureAzure');
        }
    }

    /**
     * Aktiviert den Demo-Modus
     */
    public static async enableDemoMode(context: vscode.ExtensionContext): Promise<void> {
        await context.globalState.update(this.DEMO_MODE_KEY, true);
        
        // Lösche alte API-Keys
        await ConfigManager.deleteSecret('openAIApiKey').catch(() => {});
        await ConfigManager.deleteSecret('azureApiKey').catch(() => {});
        
        await ConfigManager.set('sttProvider', 'demo');
        
        ErrorHandler.log('AutoDemo', '✅ Demo-Modus aktiviert', 'success');
        
        vscode.window.showInformationMessage(
            '🎮 Demo-Modus aktiviert!\n\n' +
            '✨ Realistische Demo-Transkriptionen\n' +
            '🎤 Drücke Ctrl+Shift+R zum Starten',
            'OK'
        );
    }

    /**
     * Deaktiviert den Demo-Modus
     */
    public static async disableDemoMode(context: vscode.ExtensionContext): Promise<void> {
        await context.globalState.update(this.DEMO_MODE_KEY, false);
        ErrorHandler.log('AutoDemo', 'Demo-Modus deaktiviert', 'success');
        
        vscode.window.showInformationMessage(
            '✅ Demo-Modus deaktiviert',
            'OpenAI konfigurieren',
            'Azure konfigurieren'
        ).then(action => {
            if (action === 'OpenAI konfigurieren') {
                vscode.commands.executeCommand('voiceDocPlugin.configureOpenAI');
            } else if (action === 'Azure konfigurieren') {
                vscode.commands.executeCommand('voiceDocPlugin.configureAzure');
            }
        });
    }

    /**
     * Prüft ob Demo-Modus aktiv ist
     */
    public static isDemoMode(context: vscode.ExtensionContext): boolean {
        return context.globalState.get<boolean>(this.DEMO_MODE_KEY, false);
    }

    /**
     * Zeigt Demo-Statistiken
     */
    public static async showDemoStats(context: vscode.ExtensionContext): Promise<void> {
        const demoUsageCount = context.globalState.get<number>('demoUsageCount', 0);
        
        vscode.window.showInformationMessage(
            `🎮 Demo-Modus Statistiken\n\n` +
            `✨ Verwendungen: ${demoUsageCount}\n\n` +
            `Der Demo-Modus ermöglicht vollständiges Testen ohne API-Keys.`,
            'Demo beenden',
            'OK'
        ).then(action => {
            if (action === 'Demo beenden') {
                this.disableDemoMode(context);
            }
        });
    }

    /**
     * Zeigt Tutorial (vereinfachte Version)
     */
    public static async showDemoTutorial(): Promise<void> {
        vscode.window.showInformationMessage(
            '🎓 Voice Doc Tutorial\n\n' +
            '1. Öffne eine Code-Datei\n' +
            '2. Cursor über Funktion setzen\n' +
            '3. Ctrl+Shift+R drücken\n' +
            '4. Demo-Transkription wird generiert!\n\n' +
            'Im Demo-Modus werden intelligente, kontextbasierte Transkriptionen simuliert.',
            'OK'
        );
    }

    /**
     * Erhöht Demo-Nutzungszähler
     */
    public static async incrementDemoUsage(context: vscode.ExtensionContext): Promise<void> {
        const count = context.globalState.get<number>('demoUsageCount', 0);
        await context.globalState.update('demoUsageCount', count + 1);
    }
}
