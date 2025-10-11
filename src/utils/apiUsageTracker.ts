import * as vscode from 'vscode';

interface ProviderStats {
    calls: number;
    duration: number;
    cost: number;
    failures: number;
}

interface DailyUsage {
    openai: ProviderStats;
    azure: ProviderStats;
}

interface UsageData {
    [date: string]: DailyUsage;
}

/**
 * Verfolgt API-Nutzung und geschätzte Kosten
 */
export class ApiUsageTracker {
    private static readonly STORAGE_KEY = 'voiceDoc.apiUsage';
    private static context: vscode.ExtensionContext | null = null;

    private static readonly COST_PER_MINUTE = {
        openai: 0.006,
        azure: 0.016667
    };

    static initialize(context: vscode.ExtensionContext): void {
        ApiUsageTracker.context = context;
    }

    static async trackTranscription(
        provider: 'openai' | 'azure',
        durationSeconds: number,
        success: boolean
    ): Promise<void> {
        if (!ApiUsageTracker.context) {
            return;
        }

        const usage = await ApiUsageTracker.getUsageData();
        const today = new Date().toISOString().split('T')[0];

        if (!usage[today]) {
            usage[today] = {
                openai: { calls: 0, duration: 0, cost: 0, failures: 0 },
                azure: { calls: 0, duration: 0, cost: 0, failures: 0 }
            };
        }

        const providerData = usage[today][provider];
        providerData.calls++;
        providerData.duration += durationSeconds;

        if (success) {
            const costPerMinute = ApiUsageTracker.COST_PER_MINUTE[provider];
            providerData.cost += (durationSeconds / 60) * costPerMinute;
        } else {
            providerData.failures++;
        }

        await ApiUsageTracker.saveUsageData(usage);
    }

    static async getUsageStats(days: number = 30): Promise<{
        totalCalls: number;
        totalDuration: number;
        totalCost: number;
        totalFailures: number;
        dailyStats: any[];
    }> {
        const usage = await ApiUsageTracker.getUsageData();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let totalCalls = 0;
        let totalDuration = 0;
        let totalCost = 0;
        let totalFailures = 0;
        const dailyStats: any[] = [];

        for (const [date, data] of Object.entries(usage)) {
            if (new Date(date) >= cutoffDate) {
                const dayTotal = {
                    date,
                    calls: (data as DailyUsage).openai.calls + (data as DailyUsage).azure.calls,
                    duration: (data as DailyUsage).openai.duration + (data as DailyUsage).azure.duration,
                    cost: (data as DailyUsage).openai.cost + (data as DailyUsage).azure.cost,
                    failures: (data as DailyUsage).openai.failures + (data as DailyUsage).azure.failures
                };

                totalCalls += dayTotal.calls;
                totalDuration += dayTotal.duration;
                totalCost += dayTotal.cost;
                totalFailures += dayTotal.failures;

                dailyStats.push(dayTotal);
            }
        }

        return {
            totalCalls,
            totalDuration,
            totalCost,
            totalFailures,
            dailyStats: dailyStats.sort((a, b) => b.date.localeCompare(a.date))
        };
    }

    static async showUsageReport(): Promise<void> {
        const stats = await ApiUsageTracker.getUsageStats(30);

        const report = `
📊 Voice Doc API Nutzung (letzte 30 Tage)

Gesamt:
• Transkriptionen: ${stats.totalCalls}
• Dauer: ${Math.round(stats.totalDuration / 60)} Minuten
• Geschätzte Kosten: $${stats.totalCost.toFixed(2)}
• Fehler: ${stats.totalFailures}

Durchschnitt pro Tag:
• ${(stats.totalCalls / 30).toFixed(1)} Transkriptionen
• $${(stats.totalCost / 30).toFixed(3)} Kosten
        `.trim();

        vscode.window.showInformationMessage(
            report,
            { modal: true },
            'Details',
            'Zurücksetzen'
        ).then(action => {
            if (action === 'Zurücksetzen') {
                ApiUsageTracker.resetUsageData();
            }
        });
    }

    private static async getUsageData(): Promise<UsageData> {
        if (!ApiUsageTracker.context) {
            return {};
        }

        const data = ApiUsageTracker.context.globalState.get<UsageData>(ApiUsageTracker.STORAGE_KEY);
        return data || {};
    }

    private static async saveUsageData(data: UsageData): Promise<void> {
        if (!ApiUsageTracker.context) {
            return;
        }

        await ApiUsageTracker.context.globalState.update(ApiUsageTracker.STORAGE_KEY, data);
    }

    private static async resetUsageData(): Promise<void> {
        if (!ApiUsageTracker.context) {
            return;
        }

        await ApiUsageTracker.context.globalState.update(ApiUsageTracker.STORAGE_KEY, {});
        vscode.window.showInformationMessage('API-Nutzungsdaten zurückgesetzt');
    }
}
