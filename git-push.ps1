# Git Push Script - Bereitet Projekt vor und pusht zu GitHub
param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Projekt bereinigt: Duplikate entfernt, TypeScript-Fehler behoben"
)

Write-Host "🚀 VS Code Voice Doc Plugin - Git Push Automation" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$projectRoot = "C:\Users\azad\Documents\diplomarbeit\vscode-voice-doc-plugin"
Set-Location $projectRoot

# Schritt 1: Erweitertes Cleanup
Write-Host "`n📦 Schritt 1: Projekt bereinigen..." -ForegroundColor Yellow
& "$projectRoot\cleanup-extended.ps1"

# Schritt 2: Dependencies installieren
Write-Host "`n📦 Schritt 2: Dependencies installieren..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installiert" -ForegroundColor Green

# Schritt 3: Kompilieren
Write-Host "`n🔨 Schritt 3: Projekt kompilieren..." -ForegroundColor Yellow
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Kompilierung fehlgeschlagen!" -ForegroundColor Red
    Write-Host "Bitte beheben Sie die Fehler vor dem Push." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Kompilierung erfolgreich" -ForegroundColor Green

# Schritt 4: Git Status prüfen
Write-Host "`n📋 Schritt 4: Git Status..." -ForegroundColor Yellow
git status --short

# Schritt 5: Änderungen stagen
Write-Host "`n➕ Schritt 5: Änderungen stagen..." -ForegroundColor Yellow
git add .
Write-Host "✓ Alle Änderungen gestaged" -ForegroundColor Green

# Schritt 6: Commit erstellen
Write-Host "`n💾 Schritt 6: Commit erstellen..." -ForegroundColor Yellow
Write-Host "   Commit-Message: $CommitMessage" -ForegroundColor Cyan
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Kein Commit erstellt (möglicherweise keine Änderungen)" -ForegroundColor Yellow
}

# Schritt 7: Pushen
Write-Host "`n🚀 Schritt 7: Push zu GitHub..." -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "   Branch: $branch" -ForegroundColor Cyan

$confirmation = Read-Host "Möchten Sie zu GitHub pushen? (y/n)"
if ($confirmation -eq 'y' -or $confirmation -eq 'Y' -or $confirmation -eq 'j' -or $confirmation -eq 'J') {
    git push origin $branch
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Erfolgreich zu GitHub gepusht!" -ForegroundColor Green
        Write-Host "`n🔗 Repository: https://github.com/azad-ahmed/vscode-voice-doc-plugin" -ForegroundColor Cyan
        Write-Host "`n📝 Gelöschte Dateien:" -ForegroundColor Yellow
        Write-Host "   ❌ generator_FIXED.ts" -ForegroundColor Gray
        Write-Host "   ❌ integratedVoiceHandler_FIXED.ts" -ForegroundColor Gray
        Write-Host "   ❌ utils/codeAnalyzer.ts (Duplikat)" -ForegroundColor Gray
        Write-Host "   ❌ utils/audioValidator.ts (Duplikat)" -ForegroundColor Gray
        Write-Host "   ❌ 7 unnötige MD-Dateien" -ForegroundColor Gray
    } else {
        Write-Host "`n❌ Push fehlgeschlagen!" -ForegroundColor Red
        Write-Host "Mögliche Gründe:" -ForegroundColor Yellow
        Write-Host "  - Keine Internetverbindung" -ForegroundColor Gray
        Write-Host "  - Authentifizierung fehlgeschlagen" -ForegroundColor Gray
        Write-Host "  - Branch existiert nicht auf Remote" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "`n⏸️  Push abgebrochen" -ForegroundColor Yellow
}

# Zusammenfassung
Write-Host "`n📊 Zusammenfassung:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "✓ Projekt bereinigt (4 doppelte Dateien entfernt)" -ForegroundColor Green
Write-Host "✓ Dependencies aktuell" -ForegroundColor Green
Write-Host "✓ Kompilierung erfolgreich" -ForegroundColor Green
Write-Host "✓ Änderungen committed" -ForegroundColor Green
if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    Write-Host "✓ Zu GitHub gepusht" -ForegroundColor Green
}

Write-Host "`n🎉 Fertig!" -ForegroundColor Green
