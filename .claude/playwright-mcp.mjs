// Startet den Playwright-MCP-Server für Claude Code (eingebunden über .mcp.json).
// Lokal gelten die Standardeinstellungen von @playwright/mcp (installiertes Chrome).
// In Claude-Code-Cloud-Sessions gibt es weder Chrome noch ein Display; dort wird
// deshalb das vorinstallierte Chromium headless gestartet.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium';

const args = ['-y', '@playwright/mcp@latest', ...process.argv.slice(2)];
if (process.env.CLAUDE_CODE_REMOTE === 'true' && existsSync(CLOUD_CHROMIUM)) {
    args.push('--browser', 'chromium', '--executable-path', CLOUD_CHROMIUM, '--headless');
}

const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
