import { STTProvider, STTConfig } from './types';
import { OpenAIWhisperProvider } from './providers/whisper';
import { AzureSTTProvider } from './providers/azure';
import { SimulatedSTTProvider } from './providers/webSpeech';
import { EnhancedDemoProvider } from './providers/enhancedDemo';
import { ConfigManager } from '../utils/configManager';
import { ErrorHandler } from '../utils/errorHandler';
import * as vscode from 'vscode';

/**
 * Factory für Speech-to-Text Provider
 */
export class STTFactory {
    static async createProvider(config: STTConfig): Promise<STTProvider> {
        let provider: STTProvider;

        switch (config.provider) {
            case 'openai-whisper':
                provider = new OpenAIWhisperProvider(config.apiKey);
                break;

            case 'azure':
                provider = new AzureSTTProvider(config.apiKey, config.region);
                break;

            case 'web-speech':
                provider = new SimulatedSTTProvider();
                break;

            default:
                throw new Error(`Unbekannter Provider: ${config.provider}`);
        }

        const available = await provider.isAvailable();
        if (!available) {
            throw new Error(`Provider nicht verfügbar: ${provider.name}`);
        }

        return provider;
    }

    static async createBestAvailableProvider(): Promise<STTProvider> {
        const preferredProvider = ConfigManager.get<string>('sttProvider');
        
        if (preferredProvider && preferredProvider !== 'auto') {
            try {
                const provider = await this.createProviderByName(preferredProvider);
                if (await provider.isAvailable()) {
                    return provider;
                }
            } catch (error) {
                ErrorHandler.log('STTFactory', `Bevorzugter Provider ${preferredProvider} nicht verfügbar`);
            }
        }

        const openaiKey = await ConfigManager.getSecret('openAIApiKey');
        if (openaiKey) {
            const whisper = new OpenAIWhisperProvider(openaiKey);
            if (await whisper.isAvailable()) {
                return whisper;
            }
        }

        const azureKey = await ConfigManager.getSecret('azureApiKey');
        const azureRegion = ConfigManager.get<string>('azureRegion');
        if (azureKey && azureRegion) {
            const azure = new AzureSTTProvider(azureKey, azureRegion);
            if (await azure.isAvailable()) {
                return azure;
            }
        }

        const demoConfirmed = await this.confirmDemoMode();
        
        if (demoConfirmed) {
            return new EnhancedDemoProvider();
        }
        
        throw new Error('Kein STT-Provider verfügbar und Demo-Modus nicht aktiviert');
    }

    private static async confirmDemoMode(): Promise<boolean> {
        const action = await vscode.window.showWarningMessage(
            '⚠️ Kein STT-Provider konfiguriert\n\n' +
            'Für echte Transkriptionen benötigen Sie einen API Key:\n' +
            '• OpenAI Whisper (empfohlen)\n' +
            '• Azure Cognitive Services\n\n' +
            'Möchten Sie im Demo-Modus fortfahren?',
            { modal: true },
            'Demo-Modus aktivieren',
            'OpenAI konfigurieren',
            'Azure konfigurieren'
        );

        if (action === 'OpenAI konfigurieren') {
            await vscode.commands.executeCommand('voiceDocPlugin.configureOpenAI');
            return false;
        } else if (action === 'Azure konfigurieren') {
            await vscode.commands.executeCommand('voiceDocPlugin.configureAzure');
            return false;
        }

        return action === 'Demo-Modus aktivieren';
    }

    private static async createProviderByName(name: string): Promise<STTProvider> {
        switch (name.toLowerCase()) {
            case 'openai':
            case 'whisper':
                const openaiKey = await ConfigManager.getSecret('openAIApiKey');
                return new OpenAIWhisperProvider(openaiKey);

            case 'azure':
                const azureKey = await ConfigManager.getSecret('azureApiKey');
                const azureRegion = ConfigManager.get<string>('azureRegion');
                return new AzureSTTProvider(azureKey, azureRegion);

            default:
                throw new Error(`Unbekannter Provider: ${name}`);
        }
    }

    static async detectAvailableProviders(): Promise<Array<{
        name: string;
        available: boolean;
        provider: STTProvider;
    }>> {
        const results = [];

        const openaiKey = await ConfigManager.getSecret('openAIApiKey');
        const whisper = new OpenAIWhisperProvider(openaiKey);
        results.push({
            name: 'OpenAI Whisper',
            available: await whisper.isAvailable(),
            provider: whisper
        });

        const azureKey = await ConfigManager.getSecret('azureApiKey');
        const azureRegion = ConfigManager.get<string>('azureRegion');
        const azure = new AzureSTTProvider(azureKey, azureRegion);
        results.push({
            name: 'Azure Cognitive Services',
            available: await azure.isAvailable(),
            provider: azure
        });

        return results;
    }
}
