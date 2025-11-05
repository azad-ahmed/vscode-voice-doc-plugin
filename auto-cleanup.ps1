# 🧹 AUTOMATIC PROJECT CLEANUP FOR GITHUB
# Voice Documentation Plugin - Cleanup Script
# Datum: 2025-01-05

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  VOICE DOC PLUGIN - PROJECT CLEANUP" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "C:\Users\azad\Documents\diplomarbeit\vscode-voice-doc-plugin"
Set-Location $projectRoot

# ============================================
# SCHRITT 1: BACKUP ERSTELLEN
# ============================================
Write-Host "[1/6] Erstelle Backup..." -ForegroundColor Yellow

$backupPath = "C:\Users\azad\Documents\diplomarbeit\backup-before-cleanup-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"

if (Test-Path $backupPath) {
    Remove-Item $backupPath -Recurse -Force
}

# Kopiere wichtige Dateien
$filesToBackup = @(
    "src",
    "package.json",
    "tsconfig.json",
    "README.md"
)

New-Item -Path $backupPath -ItemType Directory | Out-Null
foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $backupPath -Recurse -Force
    }
}

Write-Host "   ✓ Backup erstellt: $backupPath" -ForegroundColor Green
Write-Host ""

# ============================================
# SCHRITT 2: PRÜFE IMPORTS
# ============================================
Write-Host "[2/6] Analysiere Code-Verwendung..." -ForegroundColor Yellow

$utilsUsage = @{}
$utilsFiles = Get-ChildItem "src\utils\*.ts" -File

foreach ($file in $utilsFiles) {
    $filename = $file.Name
    $utilsUsage[$filename] = @{
        Used = $false
        Files = @()
    }
    
    # Suche nach Imports dieser Datei
    $searchPattern = $filename.Replace(".ts", "")
    $imports = Get-ChildItem "src" -Recurse -Filter "*.ts" | Select-String -Pattern "from.*utils.*$searchPattern" -CaseSensitive:$false
    
    if ($imports) {
        $utilsUsage[$filename].Used = $true
        $utilsUsage[$filename].Files = $imports.Filename
    }
}

Write-Host "   ✓ Code-Analyse abgeschlossen" -ForegroundColor Green
Write-Host ""

# ============================================
# SCHRITT 3: ENTFERNE UNGENUTZTE DATEIEN
# ============================================
Write-Host "[3/6] Entferne ungenutzte Dateien..." -ForegroundColor Yellow

$filesToDelete = @(
    # Ungenutzte Utils (falls nicht importiert)
    "src\utils\aiCodeAnalyzer.ts",
    "src\utils\autoDocumentationWatcher.ts",
    "src\utils\codeParser.ts",
    
    # Temporäre Ordner
    "temp",
    
    # Alte Cleanup-Skripte
    "cleanup-extended.ps1",
    "cleanup-final.ps1",
    "final-cleanup.ps1",
    
    # Entwicklungs-Dokumente
    "PROJEKT-ANALYSE.md",
    "PUSH-ANLEITUNG.md"
)

$deletedCount = 0
foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        # Prüfe bei utils ob wirklich ungenutzt
        if ($file -like "*utils\*") {
            $filename = Split-Path $file -Leaf
            if ($utilsUsage.ContainsKey($filename) -and $utilsUsage[$filename].Used) {
                Write-Host "   ⚠ Überspringe $filename (wird verwendet)" -ForegroundColor Yellow
                continue
            }
        }
        
        Remove-Item $file -Recurse -Force
        Write-Host "   ✓ Gelöscht: $file" -ForegroundColor Green
        $deletedCount++
    }
}

Write-Host "   ✓ $deletedCount Dateien/Ordner entfernt" -ForegroundColor Green
Write-Host ""

# ============================================
# SCHRITT 4: BEREINIGE TEMPORÄRE DATEIEN
# ============================================
Write-Host "[4/6] Bereinige temporäre Dateien..." -ForegroundColor Yellow

$tempPatterns = @("*.tmp", "*.bak", "*.backup", "*.log")
$cleanedFiles = 0

foreach ($pattern in $tempPatterns) {
    $files = Get-ChildItem -Path $projectRoot -Filter $pattern -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        Remove-Item $file.FullName -Force
        $cleanedFiles++
    }
}

Write-Host "   ✓ $cleanedFiles temporäre Dateien entfernt" -ForegroundColor Green
Write-Host ""

# ============================================
# SCHRITT 5: OPTIMIERE .gitignore
# ============================================
Write-Host "[5/6] Optimiere .gitignore..." -ForegroundColor Yellow

$gitignoreContent = @"
# Compiled output
out
dist
*.vsix

# Node modules
node_modules

# Test files
.vscode-test/
coverage/
.nyc_output/

# Build files
*.tsbuildinfo
.eslintcache

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Audio files (recordings)
*.wav
*.mp3
*.ogg
*.m4a
*.aac

# Environment files
.env
.env.local
.env.*.local

# OS files
.DS_Store
Thumbs.db
desktop.ini

# IDE files
.idea/
*.swp
*.swo
*~

# Temporary files
temp/
tmp/
*.tmp
*.bak
*.backup

# Backup files
backup-*/

# Cleanup scripts (nach cleanup)
cleanup-*.ps1
CLEANUP-PLAN.md
"@

Set-Content -Path ".gitignore" -Value $gitignoreContent -Encoding UTF8
Write-Host "   ✓ .gitignore optimiert" -ForegroundColor Green
Write-Host ""

# ============================================
# SCHRITT 6: PROJEKT-STATUS
# ============================================
Write-Host "[6/6] Projekt-Status..." -ForegroundColor Yellow
Write-Host ""

# Zähle Dateien
$srcFiles = (Get-ChildItem "src" -Recurse -Filter "*.ts" -File).Count
$docsFiles = (Get-ChildItem -Filter "*.md" -File).Count

Write-Host "   📊 PROJEKT-STATISTIK:" -ForegroundColor Cyan
Write-Host "      TypeScript-Dateien: $srcFiles" -ForegroundColor White
Write-Host "      Dokumentations-Dateien: $docsFiles" -ForegroundColor White
Write-Host ""

# Zeige utils-Verwendung
Write-Host "   📋 UTILS-VERWENDUNG:" -ForegroundColor Cyan
foreach ($file in $utilsUsage.Keys | Sort-Object) {
    if ($utilsUsage[$file].Used) {
        Write-Host "      ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "      ✗ $file (nicht verwendet)" -ForegroundColor Red
    }
}
Write-Host ""

# ============================================
# ZUSAMMENFASSUNG
# ============================================
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  ✅ CLEANUP ABGESCHLOSSEN!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NÄCHSTE SCHRITTE:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Kompiliere das Projekt:" -ForegroundColor White
Write-Host "   npm run compile" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Teste das Plugin:" -ForegroundColor White
Write-Host "   - Drücke F5 in VS Code" -ForegroundColor Cyan
Write-Host "   - Teste alle Features" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Git Commit & Push:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Cyan
Write-Host "   git commit -m 'Initial commit: Clean project structure'" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Backup-Location:" -ForegroundColor Yellow
Write-Host "   $backupPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Projekt ist bereit für GitHub! ✨" -ForegroundColor Green
Write-Host ""

# Pause am Ende
Read-Host "Drücke Enter zum Beenden"
