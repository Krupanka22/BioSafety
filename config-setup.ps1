# BioSafety Project - Configuration Only Setup
# Prerequisites: Node.js, Python, PostgreSQL must already be installed
# This script ONLY configures .env files and database


Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BioSafety Configuration Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# STEP 1: Copy Environment Files
Write-Host "STEP 1: Copying environment files..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "frontend\.env.local")) {
    Copy-Item "frontend\.env.example" "frontend\.env.local"
    Write-Host "✅ Created: frontend/.env.local" -ForegroundColor Green
} else {
    Write-Host "⏭️  Already exists: frontend/.env.local" -ForegroundColor Yellow
}

if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "✅ Created: backend/.env" -ForegroundColor Green
} else {
    Write-Host "⏭️  Already exists: backend/.env" -ForegroundColor Yellow
}

if (-not (Test-Path "ai-engine\.env")) {
    Copy-Item "ai-engine\.env.example" "ai-engine\.env"
    Write-Host "✅ Created: ai-engine/.env" -ForegroundColor Green
} else {
    Write-Host "⏭️  Already exists: ai-engine/.env" -ForegroundColor Yellow
}

Write-Host ""


# STEP 3: Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. 📦 Install npm dependencies:" -ForegroundColor Yellow
Write-Host "   cd frontend && npm install" -ForegroundColor Gray
Write-Host "   cd backend && npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🐍 Setup Python:" -ForegroundColor Yellow
Write-Host "   cd ai-engine" -ForegroundColor Gray
Write-Host "   python -m venv venv" -ForegroundColor Gray
Write-Host "   venv\Scripts\activate" -ForegroundColor Gray
Write-Host "   pip install -r requirements.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ▶️  Run 3 terminals:" -ForegroundColor Yellow
Write-Host "   Terminal 1: cd frontend && npm run dev" -ForegroundColor Gray
Write-Host "   Terminal 2: cd backend && npm run dev" -ForegroundColor Gray
Write-Host "   Terminal 3: cd ai-engine && python app.py" -ForegroundColor Gray
Write-Host ""
Write-Host "5. 🌐 Access at: http://localhost:5173" -ForegroundColor Yellow
Write-Host "   Login: john@example.com / password123" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
