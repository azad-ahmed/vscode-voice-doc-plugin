# Vereinfachtes Git Push Script
param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "Projekt bereinigt und TypeScript-Fehler behoben"
)

Write-Host "🚀 Git Push für Voice Doc Plugin" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

# 1. Finales Cleanup
if (Test-Path ".\final-cleanup.ps1") {
    Write-Host "📦 Führe finales Cleanup aus..." -ForegroundColor Yellow
    & ".\final-cleanup.ps1"
}

# 2. npm install
Write-Host "`n📦 Installiere Dependencies..." -ForegroundColor Yellow
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installiert" -ForegroundColor Green

# 3. Kompilieren
Write-Host "`n🔨 Kompiliere Projekt..." -ForegroundColor Yellow
npm run compile 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Kompilierung fehlgeschlagen!" -ForegroundColor Red
    npm run compile
    exit 1
}
Write-Host "✓ Kompilierung erfolgreich" -ForegroundColor Green

# 4. Git Status
Write-Host "`n📋 Git Status:" -ForegroundColor Yellow
git status --short

# 5. Stage & Commit
Write-Host "`n💾 Stage & Commit..." -ForegroundColor Yellow
git add .
git commit -m "$Message"

# 6. Push
Write-Host "`n🚀 Push zu GitHub..." -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "Branch: $branch`n" -ForegroundColor Cyan

$confirm = Read-Host "Push zu GitHub? (y/n)"
if ($confirm -match '^[yYjJ]$') {
    git push origin $branch
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Erfolgreich gepusht!" -ForegroundColor Green
        Write-Host "🔗 https://github.com/azad-ahmed/vscode-voice-doc-plugin`n" -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ Push fehlgeschlagen!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n⏸️  Push abgebrochen" -ForegroundColor Yellow
}

Write-Host "`n🎉 Fertig!" -ForegroundColor Green
