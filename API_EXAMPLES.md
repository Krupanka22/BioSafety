# API Usage Examples & Test Cases

## REST API Examples

### 1. Analyze Single Location

```bash
# Request
curl -X GET "http://localhost:3000/api/independent-monitoring/analyze?lat=12.9716&lng=77.5946&label=Market%20Square"

# Response
{
  "success": true,
  "data": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "label": "Market Square",
    "timestamp": "2026-06-01T10:30:45.123Z",
    "biosafetyScore": 62.5,
    "riskLevel": "HIGH",
    "riskColor": "#f97316",
    "factors": {
      "airQuality": {
        "aqi": 156,
        "aqiCategory": "UNHEALTHY",
        "aqiHealth": "Members of sensitive groups may experience health effects",
        "available": true,
        "timestamp": "2026-06-01T10:30:45.123Z"
      },
      "weather": {
        "temperature": 28.5,
        "humidity": 72,
        "windSpeed": 3.2,
        "windDirection": 180,
        "rainfall": 0.5,
        "uvIndex": 7.2,
        "pressure": 1013.25,
        "description": "Partly Cloudy",
        "icon": "02d",
        "riskModifier": 35,
        "tempStatus": "OPTIMAL_VIRUS_SURVIVAL",
        "humidityStatus": "HIGH_TRANSMISSION_RISK",
        "windStatus": "POOR_DISPERSION",
        "uvStatus": "HIGH_UV_PROTECTION",
        "available": true
      },
      "crowdDensity": {
        "crowdDensityScore": 75,
        "congestionLevel": "VERY_HEAVY",
        "transportHubDensity": 3,
        "marketingAreaDensity": 8,
        "eventDensity": 2,
        "trafficJunctionCount": 12,
        "hotspotsNearby": 4,
        "estimatedCrowd": "2000-5000",
        "available": true
      },
      "hygiene": {
        "hygieneScore": 45,
        "hygieneLevel": "POOR",
        "waterQuality": "Moderate",
        "sanitationFacilities": 3,
        "medicalServices": 2,
        "wasteManagement": 40,
        "available": true
      },
      "pollution": {
        "pm25": 78.5,
        "pm10": 156.2,
        "co": 8.5,
        "no2": 185,
        "so2": 45,
        "o3": 95,
        "pm25Status": "PM2.5: UNSAFE (78.5 µg/m³)",
        "pm10Status": "PM10: UNHEALTHY (156.2 µg/m³)",
        "co2Status": "CO: 8.5 detected",
        "no2Status": "NO2: UNHEALTHY (185 µg/m³)",
        "so2Status": "SO2: 45 detected",
        "o3Status": "O3: 95 detected",
        "available": true
      }
    },
    "reasoning": [
      "🚨 Air Quality UNHEALTHY - AQI 156",
      "⚠️ Pollution Concerns: PM2.5 UNSAFE (78.5 µg/m³), NO2 HIGH (185 µg/m³)",
      "💧 HIGH HUMIDITY (72%) - Moderate transmission risk",
      "🌡️ OPTIMAL VIRUS SURVIVAL - Temperature 28.5°C",
      "🌪️ LOW WIND SPEED (3.2 m/s) - Poor dispersion of pollutants",
      "👥 VERY HEAVY CROWD CONGESTION (Score: 75) - High transmission risk",
      "🚆 MAJOR TRANSPORT HUB - High mobility increase",
      "🚗 HEAVY TRAFFIC JUNCTION - Congestion hotspot",
      "🔥 MULTIPLE HOTSPOTS NEARBY - High-risk cluster area",
      "⚠️ INADEQUATE HYGIENE (Score: 45) - Sanitation concerns"
    ]
  }
}
```

### 2. Analyze Multiple Locations

```bash
# Request
curl -X POST "http://localhost:3000/api/independent-monitoring/analyze-multiple" \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {"lat": 12.9716, "lng": 77.5946, "label": "Market Square"},
      {"lat": 12.9352, "lng": 77.6245, "label": "Train Station"},
      {"lat": 13.0352, "lng": 77.8245, "label": "Airport"}
    ]
  }'

# Response
{
  "success": true,
  "count": 3,
  "data": [
    { /* Location 1 - Market Square */ },
    { /* Location 2 - Train Station */ },
    { /* Location 3 - Airport */ }
  ]
}
```

### 3. Generate Monitoring Points

```bash
# Request
curl -X GET "http://localhost:3000/api/independent-monitoring/generate-points?centerLat=12.9716&centerLng=77.5946&radiusKm=5"

# Response
{
  "success": true,
  "centerLat": 12.9716,
  "centerLng": 77.5946,
  "radiusKm": 5,
  "totalPoints": 87,
  "breakdown": {
    "gridCells": 45,
    "transportHubs": 8,
    "trafficJunctions": 15,
    "crowdedAreas": 19
  },
  "points": [
    {
      "lat": 12.9716,
      "lng": 77.5946,
      "type": "GRID_CELL",
      "h3Index": "883095d3fffffff",
      "label": "Grid Cell 883095d3"
    },
    {
      "lat": 12.9750,
      "lng": 77.6050,
      "type": "TRANSPORT_HUB",
      "name": "Bangalore Central Railway Station",
      "label": "🚆 Bangalore Central Railway Station",
      "description": "Ministry of Railways"
    },
    {
      "lat": 12.9900,
      "lng": 77.6200,
      "type": "TRAFFIC_JUNCTION",
      "name": "Traffic Junction",
      "label": "🚦 Traffic Junction",
      "description": "Major intersection"
    },
    {
      "lat": 13.0050,
      "lng": 77.6150,
      "type": "CROWDED_AREA",
      "category": "mall",
      "name": "Bangalore Shopping Mall",
      "label": "👥 Bangalore Shopping Mall",
      "description": "Major retail complex"
    }
  ]
}
```

### 4. Complete 5km Analysis

```bash
# Request
curl -X GET "http://localhost:3000/api/independent-monitoring/5km-analysis?centerLat=12.9716&centerLng=77.5946&radiusKm=5"

# Response
{
  "success": true,
  "metadata": {
    "centerLat": 12.9716,
    "centerLng": 77.5946,
    "radiusKm": 5,
    "timestamp": "2026-06-01T10:30:45.123Z"
  },
  "statistics": {
    "totalAnalyzed": 87,
    "riskLevelDistribution": {
      "CRITICAL": 5,
      "HIGH": 15,
      "MODERATE": 35,
      "LOW": 32
    },
    "averageScore": "48.3",
    "maxScore": "92.5",
    "minScore": "12.0"
  },
  "criticalZones": [
    {
      "latitude": 12.9900,
      "longitude": 77.6200,
      "biosafetyScore": 92.5,
      "riskLevel": "CRITICAL",
      "label": "Central Market Complex",
      "reasoning": [/* 10+ factor-wise reasons */]
    },
    // ... more critical zones
  ],
  "analyses": [/* All 87 locations with complete analysis */]
}
```

### 5. Heatmap Data Export

```bash
# Request
curl -X GET "http://localhost:3000/api/independent-monitoring/heatmap-data?centerLat=12.9716&centerLng=77.5946&radiusKm=5"

# Response
{
  "success": true,
  "centerLat": 12.9716,
  "centerLng": 77.5946,
  "radiusKm": 5,
  "timestamp": "2026-06-01T10:30:45.123Z",
  "points": [
    {
      "lat": 12.9716,
      "lng": 77.5946,
      "intensity": 0.625,
      "score": 62.5,
      "riskLevel": "HIGH",
      "label": "Market Square"
    },
    {
      "lat": 12.9750,
      "lng": 77.6050,
      "intensity": 0.925,
      "score": 92.5,
      "riskLevel": "CRITICAL",
      "label": "Central Market Complex"
    },
    // ... more points
  ]
}
```

## WebSocket Examples

### 1. Single Location Analysis

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // Analyze specific location
  socket.emit('analyze-location-independent', {
    lat: 12.9716,
    lng: 77.5946,
    label: 'My Location'
  });
});

socket.on('location-analysis-independent', (data) => {
  console.log('Analysis Complete:');
  console.log('Score:', data.biosafetyScore);
  console.log('Risk Level:', data.riskLevel);
  console.log('Reasoning:', data.reasoning);
  console.log('Factors:', data.factors);
});
```

### 2. Start 5km Monitoring

```javascript
socket.on('connect', () => {
  // Start monitoring 5km radius
  socket.emit('start-5km-monitoring', {
    centerLat: 12.9716,
    centerLng: 77.5946,
    radiusKm: 5,
    includeGridCells: true
  });
});

// Monitoring started
socket.on('5km-monitoring-start', (data) => {
  console.log('Monitoring started!');
  console.log('Total points:', data.totalPoints);
  console.log('Breakdown:', data.pointsByType);
});

// Individual location analyses
socket.on('independent-location-analysis', (analysis) => {
  console.log(`Location ${analysis.label}`);
  console.log(`Score: ${analysis.biosafetyScore}`);
  console.log(`Risk: ${analysis.riskLevel}`);
});

// Heatmap updates
socket.on('5km-heatmap-update', (data) => {
  console.log('Heatmap updated with', data.points.length, 'points');
  // Use data.points for rendering heatmap
});
```

### 3. Get Location Detail

```javascript
socket.emit('get-location-detail', {
  lat: 12.9716,
  lng: 77.5946,
  includeFactorWiseReasoning: true
});

socket.on('location-detail', (detail) => {
  console.log('Location:', detail.location);
  console.log('Environmental Intelligence:', {
    airQuality: detail.environmentalIntelligence.airQuality,
    weather: detail.environmentalIntelligence.weather,
    crowdMetrics: detail.environmentalIntelligence.crowdMetrics,
    hygieneAnalysis: detail.environmentalIntelligence.hygieneAnalysis,
    alerts: detail.environmentalIntelligence.alerts
  });
});
```

## Frontend Usage Examples

### React Component

```javascript
import { useIndependentMonitoring } from '../hooks/useIndependentMonitoring';

export function MonitoringPage() {
  const {
    monitoringActive,
    locations,
    heatmapData,
    selectedLocation,
    locationDetail,
    statsMonitored,
    startMonitoring,
    stopMonitoring,
    getLocationDetails,
    loading,
    error,
  } = useIndependentMonitoring(12.9716, 77.5946, 5);

  return (
    <div>
      <button onClick={startMonitoring} disabled={loading}>
        {monitoringActive ? 'Monitoring Active' : 'Start Monitoring'}
      </button>

      {monitoringActive && (
        <div>
          <p>Total Locations: {statsMonitored.totalPoints}</p>
          <p>Critical Areas: {statsMonitored.criticalLocations}</p>
          
          <div className="grid">
            {locations.map(loc => (
              <div
                key={`${loc.latitude},${loc.longitude}`}
                onClick={() => getLocationDetails(loc.latitude, loc.longitude)}
                style={{
                  backgroundColor: loc.riskColor,
                  cursor: 'pointer',
                  padding: '10px',
                  margin: '5px',
                  borderRadius: '5px'
                }}
              >
                <h3>{loc.label}</h3>
                <p>Score: {loc.biosafetyScore.toFixed(1)}</p>
                <p>Risk: {loc.riskLevel}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {locationDetail && (
        <div>
          <h2>Environmental Intelligence</h2>
          <pre>{JSON.stringify(locationDetail.environmentalIntelligence, null, 2)}</pre>
          <h3>Risk Analysis</h3>
          <ul>
            {locationDetail.alerts.map((alert, idx) => (
              <li key={idx}>{alert}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Test Cases

### Test Case 1: Single Location Analysis
**Setup**: Backend running on port 3000
**Execution**:
```bash
curl -X GET "http://localhost:3000/api/independent-monitoring/analyze?lat=12.9716&lng=77.5946"
```
**Expected Result**: HTTP 200, valid JSON with biosafetyScore field

### Test Case 2: WebSocket Connection
**Setup**: Frontend and backend running
**Execution**: Open DevTools → Network → WS → observe connections
**Expected Result**: Socket.IO connection established, no errors

### Test Case 3: 5km Monitoring Flow
**Setup**: Both servers running
**Execution**:
1. Connect to WebSocket
2. Emit `start-5km-monitoring`
3. Wait for `5km-monitoring-start`
4. Receive `independent-location-analysis` events
5. Emit `get-location-detail`
6. Verify `location-detail` response

**Expected Result**: All events received, data valid, no errors

### Test Case 4: Performance Test
**Setup**: 5km monitoring active
**Execution**: Monitor metrics for 5 minutes
**Expected Result**:
- Update cycle: 30s ± 2s
- Heatmap render: < 500ms
- Memory stable
- No memory leaks

### Test Case 5: Error Handling
**Setup**: Invalid parameters in request
**Execution**: Send requests with missing/invalid lat/lng
**Expected Result**: HTTP 400 with clear error message

## Performance Benchmarks

### Single Location Analysis
- **Time**: 800ms - 2000ms
- **API Calls**: 3 (OpenWeatherMap, Overpass, Nominatim)
- **Response Size**: 15-25 KB

### 5km Analysis (100 locations)
- **Total Time**: 30-45 seconds
- **API Calls**: 300 (3 per location)
- **Response Size**: 1.5-2.5 MB

### Heatmap Update
- **Data Size**: 20-50 KB
- **Render Time**: 200-500 ms (Leaflet + Leaflet.Heat)
- **Refresh Rate**: 30s (configurable)

## Data Format Reference

### Location Analysis Object
```typescript
{
  latitude: number;
  longitude: number;
  label: string;
  timestamp: ISO8601String;
  biosafetyScore: number;         // 0-100
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  riskColor: hex;
  factors: {
    airQuality: {...};
    weather: {...};
    crowdDensity: {...};
    hygiene: {...};
    pollution: {...};
  };
  reasoning: string[];            // Factor-wise alerts
}
```

### Heatmap Point
```typescript
{
  lat: number;
  lng: number;
  intensity: number;              // 0-1
  score: number;                  // 0-100
  riskLevel: string;
  label: string;
}
```
