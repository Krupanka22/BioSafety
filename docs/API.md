# API Reference

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "confirmPassword": "securepassword"
}

Response (201):
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword"
}

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>

Response (200):
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user"
}
```

---

### Dashboard

#### Get Risk Overview
```http
GET /dashboard/risk-overview
Authorization: Bearer <token>

Response (200):
{
  "level": "MODERATE",
  "score": 65,
  "timeToSafe": "24-48 hours",
  "trend": "increasing",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### Get Exposure Score
```http
GET /dashboard/exposure-score
Authorization: Bearer <token>

Response (200):
{
  "score": 68.5,
  "category": "MODERATE",
  "change": "+2.3%",
  "historicalData": [
    {
      "date": "2024-01-01",
      "score": 65.2
    }
  ]
}
```

#### Get Alerts
```http
GET /dashboard/alerts
Authorization: Bearer <token>

Response (200):
[
  {
    "id": 1,
    "title": "High Risk Detection",
    "message": "Unusual activity detected in Zone A",
    "severity": "high",
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

---

### Map

#### Get Locations
```http
GET /map/locations
Authorization: Bearer <token>

Response (200):
[
  {
    "id": 1,
    "name": "Central District",
    "lat": 40.7128,
    "lng": -74.006,
    "riskLevel": "HIGH",
    "riskScore": 82
  }
]
```

#### Get Heatmap Data
```http
GET /map/heatmap/region-name
Authorization: Bearer <token>

Response (200):
{
  "region": "region-name",
  "heatmapPoints": [
    {
      "lat": 40.712,
      "lng": -74.005,
      "intensity": 85.5
    }
  ],
  "generatedAt": "2024-01-15T10:30:00Z"
}
```

---

### Analytics

#### Get Predictions
```http
GET /analytics/predictions?days=30
Authorization: Bearer <token>

Response (200):
{
  "forecastDays": 30,
  "predictions": [
    {
      "date": "2024-02-15",
      "predictedRisk": 72.5,
      "confidence": 94.2,
      "factors": ["humidity", "temperature"]
    }
  ],
  "modelAccuracy": 96.2
}
```

#### Get Historical Data
```http
GET /analytics/historical?days=30
Authorization: Bearer <token>

Response (200):
{
  "period": "30 days",
  "data": [
    {
      "date": "2024-01-15",
      "actualRisk": 68.5,
      "exposures": 23,
      "cases": 5
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "status": 400,
    "message": "Validation failed"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "status": 401,
    "message": "Invalid token"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "status": 403,
    "message": "Admin access required"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "status": 500,
    "message": "Internal Server Error"
  }
}
```

---

## Rate Limiting

- **Limit**: 100 requests per 15 minutes
- **Headers**: 
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests left
  - `X-RateLimit-Reset`: Timestamp when limit resets

---

## Pagination

For list endpoints, use query parameters:
```
?page=1&limit=20&sort=-createdAt
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
