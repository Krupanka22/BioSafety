# BioSafe Platform - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+ and pip
- PostgreSQL 12+

### 1. Clone & Setup

```bash
cd biosafety

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev

# Backend (new terminal)
cd backend
npm install
cp .env.example .env
npm run dev

# AI Engine (new terminal)
cd ai-engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 2. Database Setup

```bash
# Create database
createdb biosafety_db

# Load schema
psql biosafety_db < ../database/schema.sql

# Seed data
psql biosafety_db < ../database/seeds.sql
```

### 3. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **AI Engine**: http://localhost:5000

---

## 📊 Features Overview

### Dashboard
- Real-time risk scores
- Exposure monitoring
- Active alerts
- Trend analysis

### Risk Mapping
- Geographic heat maps
- Location-based risk levels
- Interactive location details

### Analytics
- 30-day forecasts
- Trend analysis
- Model performance metrics
- Anomaly detection

### User Management
- Authentication & authorization
- Profile management
- Notification preferences
- API key generation

---

## 🔑 Key Technologies

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Express.js |
| Database | PostgreSQL |
| AI/ML | TensorFlow + Scikit-learn |
| Real-time | WebSocket (Socket.io) |

---

## 📝 Demo Credentials

```
Email: john@example.com
Password: password123
```

---

## 🐛 Troubleshooting

**Port already in use?**
```bash
# Kill process on port 3000 (backend)
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

**Database connection error?**
```bash
# Check PostgreSQL is running
psql -U postgres

# Update .env with correct credentials
```

**ML model loading error?**
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

---

## 📚 Documentation

- **Complete Docs**: [README.md](./README.md)
- **API Reference**: [API.md](./API.md)
- **ML Documentation**: [ML_MODELS.md](./ML_MODELS.md)

---

## 🚀 Deployment

### Frontend
```bash
npm run build
# Deploy dist/ to Vercel/Netlify
```

### Backend
```bash
git push heroku main
```

### AI Engine
```bash
docker build -t biosafety-ai .
docker run -p 5000:5000 biosafety-ai
```

---

## 📞 Support

For issues or questions, create an issue in the repository or contact the development team.

---

*Happy coding! 🎉*
