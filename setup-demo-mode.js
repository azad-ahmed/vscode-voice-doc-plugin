#!/usr/bin/env node

/**
 * 🎮 Auto-Setup für verbesserten Demo-Modus
 * 
 * Dieses Script integriert automatisch alle Demo-Verbesserungen in dein Projekt
 * 
 * Usage: node setup-demo-mode.js
 */

const fs = require('fs');
const path = require('path');

console.log('🎮 Voice Doc - Demo-Modus Setup\n');
console.log('='.repeat(50));

// Pfade
const projectRoot = __dirname;
const extensionPath = path.join(projectRoot, 'src', 'extension.ts');
const factoryPath = path.join(projectRoot, 'src', 'stt', 'factory.ts');
const generatorPath = path.join(projectRoot, 'src', 'generator.ts');
const packagePath = path.join(projectRoot, 'package.json');

// Backup erstellen
function createBackup(filePath) {
    const backupPath = filePath + '.backup';
    if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`✅ Backup erstellt: ${path.basename(backupPath)}`);
    }
}

// Prüfe ob Dateien existieren
function checkFiles() {
    console.log('\n📋 Prüfe Dateien...\n');
    
    const requiredFiles = [
        'src/stt/providers/enhancedDemo.ts',
        'src/utils/demoGPTEnhancer.ts',
        'src/utils/autoDemoManager.ts'
    ];
    
    let allExist = true;
    
    for (const file of requiredFiles) {
        const fullPath = path.join(projectRoot, file);
        if (fs.existsSync(fullPath)) {
            console.log(`✅ ${file}`);
        } else {
            console.log(`❌ ${file} - FEHLT!`);
            allExist = false;
        }
    }
    
    if (!allExist) {
        console.log('\n⚠️  Bitte stelle sicher dass alle Dateien vorhanden sind!');
        process.exit(1);
    }
    
    console.log('\n✅ Alle Demo-Dateien vorhanden!\n');
}

// Aktualisiere extension.ts
function updateExtension() {
    console.log('📝 Aktualisiere extension.ts...\n');
    
    let content = fs.readFileSync(extensionPath, 'utf-8');
    
    // Check ob bereits integriert
    if (content.includes('AutoDemoManager')) {
        console.log('⚠️  Extension bereits aktualisiert - überspringe\n');
        return;
    }
    
    // Füge Imports hinzu
    const importLine = "import { AutoDemoManager } from './utils/autoDemoManager';\n";
    content = content.replace(
        /(import.*from.*errorHandler.*;\n)/,
        `$1${importLine}`
    );
    
    // Füge Demo-Init in activate() hinzu
    const demoInitCode = `
    // ✨ Demo-Modus Manager initialisieren
    await AutoDemoManager.checkAndInitialize(context);
    const isDemoMode = AutoDemoManager.isDemoMode(context);
    if (isDemoMode) {
        outputChannel.appendLine('🎮 Demo-Modus ist aktiv');
    }
    
`;
    
    content = content.replace(
        /(ConfigManager\.initialize\(context\);)/,
        `$1${demoInitCode}`
    );
    
    // Füge Commands hinzu
    const commandsCode = `
    // ✨ Demo-Modus Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.showDemoTutorial', async () => {
            try {
                await AutoDemoManager.showDemoTutorial();
            } catch (error: any) {
                ErrorHandler.handleError('showDemoTutorial', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.showDemoStats', async () => {
            try {
                await AutoDemoManager.showDemoStats(context);
            } catch (error: any) {
                ErrorHandler.handleError('showDemoStats', error);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('voiceDocPlugin.toggleDemoMode', async () => {
            try {
                const isDemo = AutoDemoManager.isDemoMode(context);
                if (isDemo) {
                    await AutoDemoManager.disableDemoMode(context);
                } else {
                    await AutoDemoManager.enableDemoMode(context);
                }
            } catch (error: any) {
                ErrorHandler.handleError('toggleDemoMode', error);
            }
        })
    );
`;
    
    content = content.replace(
        /(ErrorHandler\.log\('Extension', 'Alle Commands registriert)/,
        `${commandsCode}\n    $1`
    );
    
    fs.writeFileSync(extensionPath, content, 'utf-8');
    console.log('✅ extension.ts aktualisiert\n');
}

// Aktualisiere factory.ts
function updateFactory() {
    console.log('📝 Aktualisiere factory.ts...\n');
    
    let content = fs.readFileSync(factoryPath, 'utf-8');
    
    // Check ob bereits integriert
    if (content.includes('EnhancedDemoProvider')) {
        console.log('⚠️  Factory bereits aktualisiert - überspringe\n');
        return;
    }
    
    // Füge Import hinzu
    const importLine = "import { EnhancedDemoProvider } from './providers/enhancedDemo';\n";
    content = content.replace(
        /(import.*SimulatedSTTProvider.*;\n)/,
        `$1${importLine}`
    );
    
    // Ersetze SimulatedSTTProvider mit EnhancedDemoProvider
    content = content.replace(
        /return new SimulatedSTTProvider\(\);/g,
        'return new EnhancedDemoProvider();'
    );
    
    fs.writeFileSync(factoryPath, content, 'utf-8');
    console.log('✅ factory.ts aktualisiert\n');
}

// Aktualisiere generator.ts
function updateGenerator() {
    console.log('📝 Aktualisiere generator.ts...\n');
    
    let content = fs.readFileSync(generatorPath, 'utf-8');
    
    // Check ob bereits integriert
    if (content.includes('DemoGPTEnhancer')) {
        console.log('⚠️  Generator bereits aktualisiert - überspringe\n');
        return;
    }
    
    // Füge Import hinzu
    const importLine = "import { DemoGPTEnhancer } from './utils/demoGPTEnhancer';\n";
    content = content.replace(
        /(import.*ErrorHandler.*;\n)/,
        `$1${importLine}`
    );
    
    // Füge Demo-GPT in enhanceWithOpenAI hinzu
    const demoGPTCode = `
        // ✨ Verwende Demo-GPT-Enhancer wenn kein API-Key vorhanden
        if (!this.openAIApiKey) {
            ErrorHandler.log('CommentGenerator', 'Nutze Demo-GPT-Verbesserung');
            return DemoGPTEnhancer.enhanceComment(transcript, codeContext || '');
        }
        
`;
    
    content = content.replace(
        /(public async enhanceWithOpenAI\(transcript: string, codeContext: string \| null\): Promise<string> {\s+if \(!this\.openAIApiKey\) {\s+throw new Error\('OpenAI API Key nicht konfiguriert'\);\s+})/,
        `public async enhanceWithOpenAI(transcript: string, codeContext: string | null): Promise<string> {${demoGPTCode}`
    );
    
    fs.writeFileSync(generatorPath, content, 'utf-8');
    console.log('✅ generator.ts aktualisiert\n');
}

// Aktualisiere package.json
function updatePackageJson() {
    console.log('📝 Aktualisiere package.json...\n');
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    // Check ob bereits integriert
    const hasCommands = pkg.contributes.commands.some(
        cmd => cmd.command === 'voiceDocPlugin.showDemoTutorial'
    );
    
    if (hasCommands) {
        console.log('⚠️  Package.json bereits aktualisiert - überspringe\n');
        return;
    }
    
    // Füge Commands hinzu
    const newCommands = [
        {
            command: 'voiceDocPlugin.showDemoTutorial',
            title: 'Voice Doc: Demo-Tutorial anzeigen',
            icon: '$(mortar-board)'
        },
        {
            command: 'voiceDocPlugin.showDemoStats',
            title: 'Voice Doc: Demo-Statistiken anzeigen',
            icon: '$(graph)'
        },
        {
            command: 'voiceDocPlugin.toggleDemoMode',
            title: 'Voice Doc: Demo-Modus umschalten',
            icon: '$(debug-start)'
        }
    ];
    
    pkg.contributes.commands.push(...newCommands);
    
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2), 'utf-8');
    console.log('✅ package.json aktualisiert\n');
}

// Main Setup
async function setup() {
    try {
        // 1. Prüfe Dateien
        checkFiles();
        
        // 2. Erstelle Backups
        console.log('💾 Erstelle Backups...\n');
        createBackup(extensionPath);
        createBackup(factoryPath);
        createBackup(generatorPath);
        createBackup(packagePath);
        
        // 3. Aktualisiere Dateien
        console.log('\n🔧 Integriere Demo-Modus...\n');
        updateExtension();
        updateFactory();
        updateGenerator();
        updatePackageJson();
        
        // 4. Fertig!
        console.log('='.repeat(50));
        console.log('\n🎉 Demo-Modus erfolgreich integriert!\n');
        console.log('📋 Nächste Schritte:\n');
        console.log('   1. npm run compile');
        console.log('   2. F5 drücken (Extension Development Host)');
        console.log('   3. Welcome-Dialog → "Demo-Modus aktivieren"');
        console.log('   4. Viel Spaß beim Testen! 🚀\n');
        console.log('📖 Dokumentation: DEMO_MODE_INTEGRATION.md\n');
        console.log('💡 Backups wurden erstellt (*.backup)\n');
        
    } catch (error) {
        console.error('\n❌ Fehler beim Setup:', error.message);
        console.log('\n💡 Tipp: Stelle die Backups wieder her (*.backup)');
        process.exit(1);
    }
}

// Run Setup
setup();
