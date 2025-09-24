import { WebSpeechProvider } from './providers/webSpeech';
import { AzureProvider } from './providers/azure';
import { WhisperProvider } from './providers/whisper';

export interface STTProvider {
    transcribe(audioFilePath: string): Promise<string>;
    isAvailable(): Promise<boolean>;
    getName(): string;
}

export interface STTConfig {
    provider: 'webspeech' | 'azure' | 'whisper' | 'google';
    azure?: {
        key: string;
        region: string;
    };
    google?: {
        keyFilePath?: string;
        apiKey?: string;
    };
    whisper?: {
        modelPath?: string;
        useLocal?: boolean;
    };
    language?: string;
}

export function createSTT(config: STTConfig): STTProvider {
    switch (config.provider.toLowerCase()) {
        case 'webspeech':
            return new WebSpeechProvider(config.language);
        
        case 'azure':
            if (!config.azure?.key) {
                throw new Error('Azure API Key is required for Azure STT provider');
            }
            return new AzureProvider(config.azure.key, config.azure.region, config.language);
        
        case 'whisper':
            return new WhisperProvider(config.whisper?.modelPath, config.language);
        
        case 'google':
            if (!config.google?.apiKey && !config.google?.keyFilePath) {
                throw new Error('Google API Key or Key File Path is required for Google STT provider');
            }
            // TODO: Implement Google provider when needed
            throw new Error('Google STT provider not yet implemented');
        
        default:
            throw new Error(`Unsupported STT provider: ${config.provider}`);
    }
}

export async function getAvailableProviders(): Promise<string[]> {
    const providers = ['webspeech', 'azure', 'whisper'];
    const available: string[] = [];

    for (const providerName of providers) {
        try {
            let provider: STTProvider;
            
            switch (providerName) {
                case 'webspeech':
                    provider = new WebSpeechProvider();
                    break;
                case 'azure':
                    provider = new AzureProvider('dummy', 'dummy'); // Just for availability check
                    break;
                case 'whisper':
                    provider = new WhisperProvider();
                    break;
                default:
                    continue;
            }

            if (await provider.isAvailable()) {
                available.push(providerName);
            }
        } catch (error) {
            // Provider not available, skip
        }
    }

    return available;
}