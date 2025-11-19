import * as vscode from 'vscode';

/**
 * Zentrale Konfigurationsverwaltung für die Voice Documentation Extension
 * Verwaltet Settings, API Keys und stellt Caching bereit
 */
export class ConfigManager {
    private static cache: Map<string, any> = new Map();
    private static readonly MAX_CACHE_SIZE = 50;
    private static secretStorage: vscode.SecretStorage | null = null;

    static initialize(context: vscode.ExtensionContext): void {
        ConfigManager.secretStorage = context.secrets;
        ConfigManager.migrateToSecretStorage();

        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('voiceDocPlugin')) {
                ConfigManager.clearCache();
            }
        });
    }

    static get<T>(key: string, defaultValue?: T): T | undefined {
        const fullKey = `voiceDocPlugin.${key}`;

        if (ConfigManager.cache.has(fullKey)) {
            return ConfigManager.cache.get(fullKey);
        }

        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        const value = config.get<T>(key, defaultValue as T);

        ConfigManager.cache.set(fullKey, value);
        
        // 🔒 Verhindere Memory Leak: LRU Cache-Limit
        if (ConfigManager.cache.size > ConfigManager.MAX_CACHE_SIZE) {
            const firstKey = ConfigManager.cache.keys().next().value;
            ConfigManager.cache.delete(firstKey);
        }
        
        return value;
    }

    static async set(
        key: string,
        value: any,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('voiceDocPlugin');
        await config.update(key, value, target);
        ConfigManager.cache.set(`voiceDocPlugin.${key}`, value);
    }

    static async getSecret(key: string): Promise<string | undefined> {
        if (!ConfigManager.secretStorage) {
            throw new Error('SecretStorage nicht initialisiert');
        }
        return await ConfigManager.secretStorage.get(key);
    }

    static async setSecret(key: string, value: string): Promise<void> {
        if (!ConfigManager.secretStorage) {
            throw new Error('SecretStorage nicht initialisiert');
        }

        // Speichere nur im SecretStorage, NICHT in normalen Settings
        await ConfigManager.secretStorage.store(key, value);
    }

    static async deleteSecret(key: string): Promise<void> {
        if (!ConfigManager.secretStorage) {
            throw new Error('SecretStorage nicht initialisiert');
        }
        await ConfigManager.secretStorage.delete(key);
    }

    private static async migrateToSecretStorage(): Promise<void> {
        const keysToMigrate = ['openAIApiKey', 'azureApiKey'];

        for (const key of keysToMigrate) {
            try {
                // Prüfe ob der Key bereits im SecretStorage ist
                const existingSecret = await ConfigManager.getSecret(key).catch(() => null);
                if (existingSecret) {
                    continue; // Bereits migriert
                }
                
                // Versuche alte Config zu lesen (falls vorhanden)
                const oldValue = ConfigManager.get<string>(key);
                
                // 🔒 SICHERHEIT: Validiere API Key Format
                if (oldValue && ConfigManager.isValidApiKey(oldValue)) {
                    // 1. Speichere im SecretStorage
                    await ConfigManager.setSecret(key, oldValue);
                    
                    // 2. 🔒 VERIFIZIERE dass es gespeichert wurde
                    const verifySecret = await ConfigManager.getSecret(key);
                    
                    // 3. NUR wenn erfolgreich → lösche alte Config
                    if (verifySecret === oldValue) {
                        await ConfigManager.set(key, undefined);
                        console.log(`✅ ${key} erfolgreich migriert und verifiziert`);
                    } else {
                        console.error(`❌ Migration fehlgeschlagen für ${key}: Verifikation schlug fehl`);
                    }
                }
            } catch (error) {
                console.error(`❌ Migration fehlgeschlagen für ${key}:`, error);
            }
        }
    }

    /**
     * 🔒 Validiert API Key Format
     */
    private static isValidApiKey(key: string): boolean {
        if (!key || key.trim().length === 0) return false;
        
        // OpenAI Keys: sk-... (mindestens 40 Zeichen)
        if (key.startsWith('sk-') && key.length >= 40) return true;
        
        // Azure Keys: 32 Zeichen Hex
        if (/^[a-f0-9]{32}$/i.test(key)) return true;
        
        return false;
    }

    static clearCache(): void {
        ConfigManager.cache.clear();
    }

    static async getFullConfig(): Promise<{
        sttProvider: string;
        language: string;
        openAIApiKey?: string;
        azureApiKey?: string;
        azureRegion?: string;
    }> {
        return {
            sttProvider: ConfigManager.get<string>('sttProvider', 'auto')!,
            language: ConfigManager.get<string>('language', 'de-DE')!,
            openAIApiKey: await ConfigManager.getSecret('openAIApiKey'),
            azureApiKey: await ConfigManager.getSecret('azureApiKey'),
            azureRegion: ConfigManager.get<string>('azureRegion')
        };
    }

    static async validateConfig(): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        const sttProvider = ConfigManager.get<string>('sttProvider');
        const openAIApiKey = await ConfigManager.getSecret('openAIApiKey');
        const azureApiKey = await ConfigManager.getSecret('azureApiKey');
        const azureRegion = ConfigManager.get<string>('azureRegion');

        if (sttProvider === 'openai' && !openAIApiKey) {
            errors.push('OpenAI Provider gewählt aber kein API Key konfiguriert');
        }

        if (sttProvider === 'azure') {
            if (!azureApiKey) {
                errors.push('Azure Provider gewählt aber kein API Key konfiguriert');
            }
            if (!azureRegion) {
                errors.push('Azure Provider gewählt aber keine Region konfiguriert');
            }
        }

        if (!openAIApiKey && !azureApiKey) {
            warnings.push('Kein STT-Provider konfiguriert - Demo-Modus wird verwendet');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}
