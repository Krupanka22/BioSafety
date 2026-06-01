@echo off
REM BioSafety Project - Configuration Only Setup
REM Prerequisites: Node.js, Python, PostgreSQL must already be installed
REM This script ONLY configures .env files and database

setlocal enabledelayedexpansion

echo.
echo ========================================
echo    BioSafety Configuration Setup
echo ========================================
echo.

REM STEP 1: Copy Environment Files
echo STEP 1: Copying environment files...
echo ========================================
echo.

if not exist "frontend\.env.local" (
    copy "frontend\.env.example" "frontend\.env.local"
    echo [OK] Created: frontend/.env.local
) else (
    echo [SKIP] Already exists: frontend/.env.local
)

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo [OK] Created: backend/.env
) else (
    echo [SKIP] Already exists: backend/.env
)

if not exist "ai-engine\.env" (
    copy "ai-engine\.env.example" "ai-engine\.env"
    echo [OK] Created: ai-engine/.env
) else (
    echo [SKIP] Already exists: ai-engine/.env
)

echo.

REM STEP 2: Configure Database
echo STEP 2: Setting up PostgreSQL database...
echo ========================================
echo.

echo Creating database: biosafety_db
createdb -U postgres biosafety_db 2>nul
echo [OK] Database created (or already exists)

echo.
echo Loading database schema...
psql -U postgres -d biosafety_db -f database/schema.sql
echo [OK] Schema loaded

echo.
echo Seeding sample data...
psql -U postgres -d biosafety_db -f database/seeds.sql
echo [OK] Sample data inserted

echo.

REM STEP 3: Summary
echo ========================================
echo    Configuration Complete!
echo ========================================
echo.
echo Next Steps:
echo.
echo 1. Edit backend/.env with your PostgreSQL password
echo    DB_PASSWORD=your_password_here
echo.
echo 2. Install npm dependencies:
echo    cd frontend ^&^& npm install
echo    cd backend ^&^& npm install
echo.
echo 3. Setup Python:
echo    cd ai-engine
echo    python -m venv venv
echo    venv\Scripts\activate
echo    pip install -r requirements.txt
echo.
echo 4. Run 3 terminals:
echo    Terminal 1: cd frontend ^&^& npm run dev
echo    Terminal 2: cd backend ^&^& npm run dev
echo    Terminal 3: cd ai-engine ^&^& python app.py
echo.
echo 5. Access at: http://localhost:5173
echo    Login: john@example.com / password123
echo.
echo ========================================
echo.

pause
