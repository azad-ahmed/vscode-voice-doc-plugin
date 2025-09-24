# PowerShell Cleanup Script für Voice Doc Plugin
Write-Host "🧹 Bereinige Voice Doc Plugin..." -ForegroundColor Cyan

# Lösche problematische Dateien
$filesToDelete = @(
    "src/services/aiService.ts",
    "src/services",
    "src/audioRecorder.ts",
    "src/speechRecognition.ts",
    "src/test"
)

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        Remove-Item -Recurse -Force $file -ErrorAction SilentlyContinue
        Write-Host "  ❌ Gelöscht: $file" -ForegroundColor Red
    }
}

# Lösche Build-Artefakte
Write-Host "`n🗑️  Lösche Build-Artefakte..." -ForegroundColor Yellow
if (Test-Path node_modules) { 
    Remove-Item -Recurse -Force node_modules 
    Write-Host "  ✓ node_modules gelöscht" -ForegroundColor Green
}
if (Test-Path package-lock.json) { 
    Remove-Item -Force package-lock.json 
    Write-Host "  ✓ package-lock.json gelöscht" -ForegroundColor Green
}
if (Test-Path out) { 
    Remove-Item -Recurse -Force out 
    Write-Host "  ✓ out/ gelöscht" -ForegroundColor Green
}

# Erstelle saubere src-Struktur
Write-Host "`n📁 Erstelle saubere Struktur..." -ForegroundColor Cyan

# Stelle sicher, dass nur die 3 Hauptdateien existieren
$requiredFiles = @(
    "src/extension.ts",
    "src/generator.ts", 
    "src/integratedVoiceHandler.ts"
)

Write-Host "  Benötigte Dateien:" -ForegroundColor White
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "    ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "    ❌ $file fehlt!" -ForegroundColor Red
    }
}

Write-Host "`n📦 Installiere Dependencies..." -ForegroundColor Cyan
npm install

Write-Host "`n🔨 Kompiliere TypeScript..." -ForegroundColor Cyan
npm run compile

Write-Host "`n✨ Bereinigung abgeschlossen!" -ForegroundColor Green
Write-Host "   Drücke F5 in VS Code zum Testen" -ForegroundColor Yellow