# System Architecture

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Web Browser                            │
│           (Chrome, Firefox, Safari, Edge)                    │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼───────────────────────────────────┐
│                    Frontend Application                       │
│  React 18 + Vite + Tailwind CSS + Framer Motion             │
│                                                              │
│  ├─ Landing Page                                            │
│  ├─ Authentication (Login/Register)                         │
│  ├─ Dashboard                                               │
│  ├─ Map Visualization                                       │
│  ├─ Analytics                                               │
│  └─ Settings & Profile                                      │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API + WebSocket
┌──────────────────────────▼───────────────────────────────────┐
│                    API Gateway Layer                          │
│              Express.js + Socket.io                          │
│                                                              │
│  ├─ Request Validation                                      │
│  ├─ JWT Authentication                                      │
│  ├─ Rate Limiting                                           │
│  └─ Error Handling                                          │
└──────────────────────┬──────────────────┬────────────────────┘
                       │                  │
        ┌──────────────▼──────────┐    ┌──▼──────────────────┐
        │  Business Logic Layer   │    │   AI Engine Layer   │
        │                         │    │                     │
        │ ├─ Auth Service         │    │ ├─ Risk Prediction  │
        │ ├─ Dashboard Service    │    │ ├─ Forecasting     │
        │ ├─ Map Service          │    │ ├─ Analytics       │
        │ ├─ Alert Service        │    │ └─ Anomaly Detect  │
        │ └─ User Service         │    │                     │
        └──────────────┬──────────┘    └──┬──────────────────┘
                       │                  │
        ┌──────────────▼──────────────────▼──┐
        │                                     │
        │      PostgreSQL Database            │
        │                                     │
        │  ├─ Users Table                    │
        │  ├─ Risk Data Table                │
        │  ├─ Locations Table                │
        │  ├─ Alerts Table                   │
        │  ├─ Predictions Table              │
        │  └─ Analytics Table                │
        │                                     │
        └─────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Architecture
```
React App
├── Pages
│   ├── Landing (Public)
│   ├── Login (Public)
│   ├── Register (Public)
│   ├── Dashboard (Protected)
│   ├── MapView (Protected)
│   ├── Analytics (Protected)
│   ├── Profile (Protected)
│   └── Settings (Protected)
│
├── Components (Reusable)
│   ├── ProtectedRoute
│   ├── Navbar
│   ├── Sidebar
│   ├── Loader
│   ├── Cards
│   └── Charts
│
├── Context (State Management)
│   ├── AuthContext
│   ├── DashboardStore
│   ├── AnalyticsStore
│   └── MapStore
│
├── Services
│   └── API Client
│
└── Utils
    ├── Validators
    ├── Formatters
    └── Helpers
```

### Backend Architecture
```
Express.js Server
├── Routes
│   ├── /auth
│   ├── /dashboard
│   ├── /map
│   ├── /analytics
│   ├── /alerts
│   └── /users
│
├── Controllers
│   ├── AuthController
│   ├── DashboardController
│   ├── MapController
│   ├── AnalyticsController
│   └── UserController
│
├── Middleware
│   ├── Authentication
│   ├── Error Handling
│   ├── Validation
│   └── Logging
│
├── Services
│   ├── UserService
│   ├── RiskService
│   ├── AlertService
│   └── AnalyticsService
│
└── Database
    ├── Migrations
    ├── Seeds
    └── Schema
```

### AI Engine Architecture
```
Python Flask App
├── Models
│   ├── RiskPredictionModel
│   ├── ExposureAnalyzer
│   ├── PredictiveForecaster
│   └── AnomalyDetector
│
├── Engines
│   ├── AnalyticsEngine
│   └── ExplainabilityEngine
│
├── Pipelines
│   ├── DataPreprocessing
│   ├── FeatureEngineering
│   └── ModelTraining
│
├── Utils
│   ├── DataLoaders
│   ├── Validators
│   └── Formatters
│
└── API Endpoints
    ├── /predict-risk
    ├── /calculate-exposure
    ├── /forecast-risk
    ├── /detect-anomalies
    └── /generate-recommendations
```

---

## Data Flow

### 1. User Authentication Flow
```
User Input (Email/Password)
    ↓
Frontend Validation
    ↓
POST /auth/login
    ↓
Backend Authentication
    ↓
JWT Token Generation
    ↓
Token Stored (localStorage)
    ↓
Protected Routes Accessible
```

### 2. Risk Prediction Flow
```
Real-time Sensor Data
    ↓
Backend API Receives Data
    ↓
Feature Engineering
    ↓
Send to AI Engine
    ↓
Risk Prediction Model
    ↓
Risk Score & Category
    ↓
Store in Database
    ↓
Frontend Displays via WebSocket
```

### 3. Alert Generation Flow
```
Risk Score Exceeds Threshold
    ↓
Backend Triggers Alert
    ↓
Alert Saved to Database
    ↓
WebSocket Emit to Connected Clients
    ↓
Frontend Shows Notification
    ↓
Optional Email/SMS
```

---

## Scalability Considerations

### Horizontal Scaling
- Multiple backend instances behind load balancer
- Database read replicas
- Caching layer (Redis)
- Message queue (RabbitMQ) for async tasks

### Vertical Scaling
- Database indexing optimization
- Query optimization
- Connection pooling
- Memory management

### Caching Strategy
- Frontend: Browser cache + localStorage
- Backend: Redis cache for frequent queries
- API: Response caching (30-60s)

---

## Security Architecture

### Authentication & Authorization
```
┌─────────────────────────────┐
│  User Login Request         │
└────────────┬────────────────┘
             │
┌────────────▼─────────────┐
│  Hash Password Check     │
│  (bcrypt)                │
└────────────┬─────────────┘
             │
┌────────────▼──────────────────┐
│  JWT Token Generation         │
│  exp: 7 days                  │
│  claims: id, email, role      │
└────────────┬──────────────────┘
             │
┌────────────▼─────────────────────┐
│  Token in Authorization Header   │
│  Bearer <token>                  │
└────────────┬─────────────────────┘
             │
┌────────────▼──────────────────┐
│  Middleware Verification      │
│  (Check token validity)       │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────┐
│  Role-Based Access Control│
│  (Check permissions)      │
└────────────┬──────────────┘
             │
┌────────────▼──────────────┐
│  Grant/Deny Access        │
└───────────────────────────┘
```

### Data Protection
- HTTPS/TLS encryption in transit
- Password hashing (bcrypt)
- Environment variables for secrets
- SQL parameterization
- Input validation & sanitization

---

## Performance Optimization

### Frontend
- Code splitting (Vite)
- Lazy loading components
- Image optimization
- CSS-in-JS optimization
- Minification & compression

### Backend
- Database indexing
- Query optimization
- Connection pooling
- Response caching
- Compression middleware

### AI Engine
- Model serialization
- Batch prediction
- Async processing
- Efficient numpy operations

---

## Monitoring & Observability

### Application Monitoring
- Request/response logging
- Error tracking
- Performance metrics
- User analytics

### System Monitoring
- CPU & memory usage
- Database performance
- API latency
- Error rates

### Health Checks
- API health endpoint
- Database connectivity
- Model availability
- Cache status

---

## Disaster Recovery

### Backup Strategy
- Daily database backups
- Model version control
- Configuration backups
- Version control (Git)

### Recovery Plan
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 day
- Backup location: Separate server/cloud
- Regular restoration testing

---

## Cost Optimization

- Cloud resources auto-scaling
- Reserved instances for stable load
- CDN for static assets
- Database query optimization
- Compression strategies

---

## Deployment Pipeline

```
Git Push
    ↓
CI/CD Pipeline (GitHub Actions/GitLab CI)
    ↓
├─ Run Tests
├─ Lint Code
└─ Build Artifacts
    ↓
Deploy to Staging
    ↓
Automated Testing
    ↓
Manual Approval
    ↓
Deploy to Production
    ↓
Health Checks
    ↓
Monitor & Log
```

---

*Architecture designed for scalability, security, and maintainability.*
