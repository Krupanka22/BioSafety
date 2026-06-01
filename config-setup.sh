#!/bin/bash

# BioSafety Project - Configuration Only Setup
# Prerequisites: Node.js, Python, PostgreSQL must already be installed
# This script ONLY configures .env files and database

echo ""
echo "========================================"
echo "   BioSafety Configuration Setup"
echo "========================================"
echo ""

# STEP 1: Copy Environment Files
echo "STEP 1: Copying environment files..."
echo "========================================"
echo ""

if [ ! -f "frontend/.env.local" ]; then
    cp "frontend/.env.example" "frontend/.env.local"
    echo "✅ Created: frontend/.env.local"
else
    echo "⏭️  Already exists: frontend/.env.local"
fi

if [ ! -f "backend/.env" ]; then
    cp "backend/.env.example" "backend/.env"
    echo "✅ Created: backend/.env"
else
    echo "⏭️  Already exists: backend/.env"
fi

if [ ! -f "ai-engine/.env" ]; then
    cp "ai-engine/.env.example" "ai-engine/.env"
    echo "✅ Created: ai-engine/.env"
else
    echo "⏭️  Already exists: ai-engine/.env"
fi

echo ""

# STEP 2: Configure Database
echo "STEP 2: Setting up PostgreSQL database..."
echo "========================================"
echo ""

echo "Creating database: biosafety_db"
createdb -U postgres biosafety_db 2>/dev/null || true
echo "✅ Database created (or already exists)"

echo ""
echo "Loading database schema..."
psql -U postgres -d biosafety_db -f database/schema.sql
echo "✅ Schema loaded"

echo ""
echo "Seeding sample data..."
psql -U postgres -d biosafety_db -f database/seeds.sql
echo "✅ Sample data inserted"

echo ""

# STEP 3: Summary
echo "========================================"
echo "   Configuration Complete!"
echo "========================================"
echo ""

echo "Next Steps:"
echo ""
echo "1. ✏️  Edit backend/.env with your PostgreSQL password:"
echo "   DB_PASSWORD=your_password_here"
echo ""
echo "2. 📦 Install npm dependencies:"
echo "   cd frontend && npm install"
echo "   cd backend && npm install"
echo ""
echo "3. 🐍 Setup Python:"
echo "   cd ai-engine"
echo "   python -m venv venv"
echo "   source venv/bin/activate"
echo "   pip install -r requirements.txt"
echo ""
echo "4. ▶️  Run 3 terminals:"
echo "   Terminal 1: cd frontend && npm run dev"
echo "   Terminal 2: cd backend && npm run dev"
echo "   Terminal 3: cd ai-engine && python app.py"
echo ""
echo "5. 🌐 Access at: http://localhost:5173"
echo "   Login: john@example.com / password123"
echo ""
echo "========================================"
