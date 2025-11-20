# 🧹 VoiceDoc Project Cleanup Script
# Löscht alle Backup-Dateien und bereitet Projekt für Git vor

Write-Host "🧹 Starte Projekt-Cleanup..." -ForegroundColor Cyan

$projectRoot = $PSScriptRoot

# 1. Lösche Backup-Dateien
Write-Host "`n📁 Lösche Backup-Dateien..." -ForegroundColor Yellow

$backupFiles = @(
    "src\automode\projectMonitor.BACKUP.ts",
    "src\automode\projectMonitor.IMPROVED.ts",
    "src\automode\projectMonitor.ts.backup",
    "src\extension_UPDATED.ts",
    "src\placement\intelligentPlacer.ts.backup"
)

foreach ($file in $backupFiles) {
    $fullPath = Join-Path $projectRoot $file
    if (Test-Path $fullPath) {
        Remove-Item $fullPath -Force
        Write-Host "  ✅ Gelöscht: $file" -ForegroundColor Green
    } else {
        Write-Host "  ⏭️  Nicht gefunden: $file" -ForegroundColor Gray
    }
}

# 2. Lösche redundante Ordner
Write-Host "`n📁 Lösche redundante Ordner..." -ForegroundColor Yellow

$redundantFolders = @(
    "backup-deleted-code",
    "redundant",
    "documented-versions",
    "temp"
)

foreach ($folder in $redundantFolders) {
    $fullPath = Join-Path $projectRoot $folder
    if (Test-Path $fullPath) {
        Remove-Item $fullPath -Recurse -Force
        Write-Host "  ✅ Gelöscht: $folder" -ForegroundColor Green
    } else {
        Write-Host "  ⏭️  Nicht gefunden: $folder" -ForegroundColor Gray
    }
}

# 3. Erstelle/Update .gitignore
Write-Host "`n📝 Aktualisiere .gitignore..." -ForegroundColor Yellow

$gitignorePath = Join-Path $projectRoot ".gitignore"
$gitignoreContent = @"
# Compiled output
out/
dist/
*.vsix

# Node modules
node_modules/

# TypeScript cache
*.tsbuildinfo

# VS Code
.vscode/settings.json
.vscode/launch.json
!.vscode/extensions.json
!.vscode/tasks.json

# OS files
.DS_Store
Thumbs.db

# Backup files
*.backup
*.BACKUP.*
*.IMPROVED.*
*_UPDATED.*
*.bak

# Temp folders
temp/
tmp/
backup-deleted-code/
redundant/
documented-versions/

# Environment
.env
.env.local

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# API Keys (wichtig!)
.api-keys
secrets/
"@

Set-Content -Path $gitignorePath -Value $gitignoreContent -Force
Write-Host "  ✅ .gitignore aktualisiert" -ForegroundColor Green

# 4. Prüfe package.json
Write-Host "`n📦 Prüfe package.json..." -ForegroundColor Yellow
$packageJsonPath = Join-Path $projectRoot "package.json"
if (Test-Path $packageJsonPath) {
    Write-Host "  ✅ package.json gefunden" -ForegroundColor Green
} else {
    Write-Host "  ❌ package.json fehlt!" -ForegroundColor Red
}

# 5. Kompiliere Projekt
Write-Host "`n🔨 Kompiliere TypeScript..." -ForegroundColor Yellow
Set-Location $projectRoot
npm run compile

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Kompilierung erfolgreich!" -ForegroundColor Green
} else {
    Write-Host "  ❌ Kompilierung fehlgeschlagen!" -ForegroundColor Red
    Write-Host "  💡 Bitte Fehler beheben vor Git-Push" -ForegroundColor Yellow
    exit 1
}

# 6. Prüfe Git-Status
Write-Host "`n📊 Git-Status..." -ForegroundColor Yellow

if (Test-Path (Join-Path $projectRoot ".git")) {
    git status --short
    Write-Host "`n✅ Projekt ist Git-ready!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Kein Git-Repository gefunden" -ForegroundColor Yellow
    Write-Host "  💡 Initialisiere mit: git init" -ForegroundColor Cyan
}

# 7. Zusammenfassung
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "✨ Cleanup abgeschlossen!" -ForegroundColor Green
Write-Host ("="*60) -ForegroundColor Cyan

Write-Host "`nNächste Schritte:" -ForegroundColor Cyan
Write-Host "  1. Prüfe geänderte Dateien: git status" -ForegroundColor White
Write-Host "  2. Stage Änderungen: git add ." -ForegroundColor White
Write-Host "  3. Commit: git commit -m 'Projekt bereinigt und Auto-Mode verbessert'" -ForegroundColor White
Write-Host "  4. Push: git push origin main" -ForegroundColor White

Write-Host "`n💡 Tipp: Teste die Extension (F5) vor dem Push!`n" -ForegroundColor Yellow
