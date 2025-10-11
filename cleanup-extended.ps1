# Erweiteres Cleanup Script - Entfernt ALLE überflüssigen Dateien
Write-Host "🧹 Erweitertes Projekt-Cleanup..." -ForegroundColor Cyan

$projectRoot = "C:\Users\azad\Documents\diplomarbeit\vscode-voice-doc-plugin"
Set-Location $projectRoot

Write-Host "`n📋 Phase 1: Alte MD-Dateien..." -ForegroundColor Yellow

# Liste der zu löschenden MD-Dateien
$mdFilesToDelete = @(
    "COMPILATION-FIX.md",
    "FINALE-ZUSAMMENFASSUNG.md",
    "INTEGRATION-ABGESCHLOSSEN.md",
    "PROJEKT-ERWEITERUNG.md",
    "README-ERWEITERT.md",
    "START.md",
    "TYPESCRIPT-FEHLER-FIX.md"
)

foreach ($file in $mdFilesToDelete) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        Remove-Item $filePath -Force
        Write-Host "  ✓ Gelöscht: $file" -ForegroundColor Green
    }
}

Write-Host "`n📋 Phase 2: Backup/Überflüssige Scripts..." -ForegroundColor Yellow

$scriptsToDelete = @(
    "cleanup.ps1",
    "cleanup.sh",
    "package.json.ADD"
)

foreach ($file in $scriptsToDelete) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        Remove-Item $filePath -Force
        Write-Host "  ✓ Gelöscht: $file" -ForegroundColor Green
    }
}

Write-Host "`n📋 Phase 3: Doppelte/Backup Source-Dateien..." -ForegroundColor Yellow

# KRITISCH: Backup-Dateien mit _FIXED
$sourceFilesToDelete = @(
    "src\generator_FIXED.ts",
    "src\integratedVoiceHandler_FIXED.ts",
    "src\utils\codeAnalyzer.ts",
    "src\utils\audioValidator.ts"
)

foreach ($file in $sourceFilesToDelete) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        Remove-Item $filePath -Force
        Write-Host "  ✓ Gelöscht: $file" -ForegroundColor Green
    }
}

Write-Host "`n📋 Phase 4: Temp/Build-Verzeichnisse..." -ForegroundColor Yellow

# Lösche temp-Verzeichnis
$tempDir = Join-Path $projectRoot "temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
    Write-Host "  ✓ Gelöscht: temp/" -ForegroundColor Green
}

# Lösche out-Verzeichnis (wird beim Compile neu erstellt)
$outDir = Join-Path $projectRoot "out"
if (Test-Path $outDir) {
    Remove-Item $outDir -Recurse -Force
    Write-Host "  ✓ Gelöscht: out/" -ForegroundColor Green
}

Write-Host "`n✅ Cleanup abgeschlossen!" -ForegroundColor Green

Write-Host "`n📊 Zusammenfassung gelöschter Dateien:" -ForegroundColor Cyan
Write-Host "  ❌ 7 unnötige MD-Dateien" -ForegroundColor Gray
Write-Host "  ❌ 3 obsolete Scripts" -ForegroundColor Gray
Write-Host "  ❌ 4 doppelte/backup Source-Dateien:" -ForegroundColor Gray
Write-Host "     - generator_FIXED.ts (Backup)" -ForegroundColor DarkGray
Write-Host "     - integratedVoiceHandler_FIXED.ts (Backup)" -ForegroundColor DarkGray
Write-Host "     - utils/codeAnalyzer.ts (Duplikat)" -ForegroundColor DarkGray
Write-Host "     - utils/audioValidator.ts (Duplikat)" -ForegroundColor DarkGray
Write-Host "  ❌ 2 Build-Verzeichnisse" -ForegroundColor Gray

Write-Host "`n✅ Verbleibende wichtige Dateien:" -ForegroundColor Green
Write-Host "  ✓ README.md" -ForegroundColor DarkGray
Write-Host "  ✓ CHANGELOG.md" -ForegroundColor DarkGray
Write-Host "  ✓ ARCHITECTURE.md" -ForegroundColor DarkGray
Write-Host "  ✓ CONTRIBUTING.md" -ForegroundColor DarkGray
Write-Host "  ✓ USER_GUIDE.md" -ForegroundColor DarkGray
Write-Host "  ✓ LICENSE" -ForegroundColor DarkGray
Write-Host "  ✓ Alle aktiven Source-Dateien in src/" -ForegroundColor DarkGray

Write-Host "`n🔨 Nächste Schritte:" -ForegroundColor Yellow
Write-Host "   1. npm install" -ForegroundColor White
Write-Host "   2. npm run compile" -ForegroundColor White
Write-Host "   3. .\git-push.ps1" -ForegroundColor White
