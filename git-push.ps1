# 🚀 Git Push Script
# Bereitet Projekt vor und pushed zu GitHub

param(
    [string]$CommitMessage = "Projekt bereinigt und Auto-Mode verbessert"
)

Write-Host "🚀 Git Push Vorbereitung..." -ForegroundColor Cyan

$projectRoot = $PSScriptRoot
Set-Location $projectRoot

# 1. Cleanup durchführen
Write-Host "`n🧹 Führe Cleanup durch..." -ForegroundColor Yellow
& "$projectRoot\cleanup.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Cleanup fehlgeschlagen!" -ForegroundColor Red
    exit 1
}

# 2. Git Status prüfen
Write-Host "`n📊 Prüfe Git-Status..." -ForegroundColor Yellow

if (-not (Test-Path ".git")) {
    Write-Host "  ❌ Kein Git-Repository gefunden!" -ForegroundColor Red
    Write-Host "  💡 Initialisiere mit: git init" -ForegroundColor Yellow
    exit 1
}

# 3. Zeige Änderungen
Write-Host "`n📝 Geänderte Dateien:" -ForegroundColor Yellow
git status --short

# 4. Frage Benutzer
Write-Host "`n❓ Möchtest du diese Änderungen committen?" -ForegroundColor Cyan
Write-Host "   Commit Message: '$CommitMessage'" -ForegroundColor White
$confirmation = Read-Host "   (j/n)"

if ($confirmation -ne 'j' -and $confirmation -ne 'J' -and $confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "`n⏹️  Abgebrochen" -ForegroundColor Yellow
    exit 0
}

# 5. Stage alle Änderungen
Write-Host "`n📦 Stage Änderungen..." -ForegroundColor Yellow
git add .

# 6. Commit
Write-Host "💾 Erstelle Commit..." -ForegroundColor Yellow
git commit -m "$CommitMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Commit fehlgeschlagen!" -ForegroundColor Red
    exit 1
}

# 7. Push
Write-Host "`n🚀 Pushe zu GitHub..." -ForegroundColor Yellow
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Erfolgreich gepushed!" -ForegroundColor Green
    
    # Zeige Remote URL
    $remoteUrl = git config --get remote.origin.url
    Write-Host "`n🔗 Repository: $remoteUrl" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Push fehlgeschlagen!" -ForegroundColor Red
    Write-Host "💡 Mögliche Gründe:" -ForegroundColor Yellow
    Write-Host "   - Remote nicht konfiguriert: git remote add origin <url>" -ForegroundColor White
    Write-Host "   - Authentifizierung fehlgeschlagen" -ForegroundColor White
    Write-Host "   - Branch existiert nicht: git push -u origin main" -ForegroundColor White
    exit 1
}

Write-Host "`n" + ("="*60) -ForegroundColor Green
Write-Host "✨ Git Push abgeschlossen!" -ForegroundColor Green
Write-Host ("="*60) -ForegroundColor Green
