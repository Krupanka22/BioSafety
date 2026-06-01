import logger from '../utils/logger.js';
import { fetchCrowdForHexIndependent } from './crowdDensityService.js';
import { fetchHygieneScoreForLocation } from './hygieneService.js';
import { fetchOpenWeatherForHex, normaliseAqiForRisk } from './weatherService.js';

/**
 * Multi-Point Independent Monitoring Service
 * Fetches and analyzes environmental data INDEPENDENTLY for each location within 5km radius.
 * No value reuse between regions.
 */

const locationCache = new Map(); // lat,lng → cachedData with timestamp
const CACHE_DURATION_MS = 840000; // 14 minutes for independent updates (slightly less than poll interval)
const MAX_CONCURRENT_FETCHES = 3; // Reduced from 5 to prevent API rate limiting

/**
 * Helper with retry logic and timeout
 */
async function withRetry(operation, retries = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(`Operation failed (attempt ${i + 1}/${retries}): ${error.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1))); // Exponential backoff
      }
    }
  }
  throw lastError;
}

/**
 * Factor-wise biosafety analysis with independent scoring
 */
export async function analyzeLocationIndependently(lat, lng, label = null) {
  // Coordinate Validation
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.error(`Invalid coordinates provided: ${lat}, ${lng}`);
    return {
      latitude: lat,
      longitude: lng,
      label: label || `Invalid Location`,
      timestamp: new Date().toISOString(),
      biosafetyScore: 0,
      riskLevel: 'UNAVAILABLE',
      riskColor: '#9ca3af',
      factors: {},
      reasoning: ['Invalid coordinates provided'],
      error: 'Invalid coordinates',
    };
  }

  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const now = Date.now();
  
  // Check if we have fresh cache
  const cached = locationCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
    return cached.data;
  }

  try {
    // INDEPENDENT API CALLS - No shared/averaged values - With Retry Logic
    const [owmData, crowdData, hygieneData] = await withRetry(() => Promise.all([
      fetchOpenWeatherForHex(`ind_${lat}_${lng}`, lat, lng),
      fetchCrowdForHexIndependent(`ind_${lat}_${lng}`, lat, lng),
      fetchHygieneScoreForLocation(lat, lng, 0.5, {}, `ind_${lat}_${lng}`),
    ]), 3, 2000);

    // Extract independent factors
    const factors = {
      airQuality: extractAirQualityFactors(owmData),
      weather: extractWeatherFactors(owmData),
      crowdDensity: extractCrowdFactors(crowdData),
      hygiene: extractHygieneFactors(hygieneData),
      pollution: extractPollutionFactors(owmData),
    };

    // Generate factor-wise reasoning
    const reasoning = generateFactorWiseReasoning(factors);

    // Calculate independent biosafety score
    const biosafetyScore = calculateIndependentBiosafetyScore(factors);

    const analysis = {
      latitude: lat,
      longitude: lng,
      label: label || `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      timestamp: new Date().toISOString(),
      biosafetyScore,
      riskLevel: getRiskLevel(biosafetyScore),
      riskColor: getRiskColor(biosafetyScore),
      factors,
      reasoning,
      rawData: {
        owm: owmData,
        crowd: crowdData,
        hygiene: hygieneData,
      },
    };

    // Cache the result
    locationCache.set(cacheKey, { data: analysis, timestamp: now });
    return analysis;
  } catch (error) {
    logger.error(`Error analyzing location ${lat}, ${lng}:`, error);
    return {
      latitude: lat,
      longitude: lng,
      label: label || `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      timestamp: new Date().toISOString(),
      biosafetyScore: 0,
      riskLevel: 'UNAVAILABLE',
      riskColor: '#9ca3af',
      factors: {},
      reasoning: ['Data unavailable'],
      error: error.message,
    };
  }
}

/**
 * Analyze multiple independent locations in parallel
 */
export async function analyzeMultipleLocationsIndependently(locations) {
  const results = [];
  
  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < locations.length; i += MAX_CONCURRENT_FETCHES) {
    const batch = locations.slice(i, i + MAX_CONCURRENT_FETCHES);
    const batchResults = await Promise.all(
      batch.map(loc => analyzeLocationIndependently(loc.lat, loc.lng, loc.label))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Extract and structure air quality factors independently
 */
function extractAirQualityFactors(owmData) {
  return {
    aqi: owmData.aqi || 0,
    aqiCategory: getAQICategory(owmData.aqi),
    aqiHealth: getAQIHealthEffect(owmData.aqi),
    available: owmData.available,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract and structure pollution factors independently
 */
function extractPollutionFactors(owmData) {
  return {
    pm25: owmData.pm25 || 0,
    pm10: owmData.pm10 || 0,
    co: owmData.co || 0,
    no2: owmData.no2 || 0,
    so2: owmData.so2 || 0,
    o3: owmData.o3 || 0,
    pm25Status: getPollutantStatus(owmData.pm25, 'PM2.5'),
    pm10Status: getPollutantStatus(owmData.pm10, 'PM10'),
    co2Status: getPollutantStatus(owmData.co, 'CO'),
    no2Status: getPollutantStatus(owmData.no2, 'NO2'),
    so2Status: getPollutantStatus(owmData.so2, 'SO2'),
    o3Status: getPollutantStatus(owmData.o3, 'O3'),
    available: owmData.available,
  };
}

/**
 * Extract and structure weather factors independently
 */
function extractWeatherFactors(owmData) {
  return {
    temperature: owmData.temp || 0,
    humidity: owmData.humidity || 0,
    windSpeed: owmData.windSpeed || 0,
    windDirection: owmData.windDirection || 0,
    rainfall: owmData.rainfall || 0,
    uvIndex: owmData.uvIndex || 0,
    pressure: owmData.pressure || 0,
    description: owmData.weatherDescription || 'Unknown',
    icon: owmData.icon || '',
    riskModifier: owmData.weatherRiskModifier || 0,
    tempStatus: getTemperatureStatus(owmData.temp),
    humidityStatus: getHumidityStatus(owmData.humidity),
    windStatus: getWindStatus(owmData.windSpeed),
    uvStatus: getUVStatus(owmData.uvIndex),
    available: owmData.available,
  };
}

/**
 * Extract and structure crowd density factors independently
 */
function extractCrowdFactors(crowdData) {
  return {
    crowdDensityScore: crowdData.crowdDensityScore || 0,
    congestionLevel: getCongestionLevel(crowdData.crowdDensityScore),
    transportHubDensity: crowdData.transportHubDensity || 0,
    marketingAreaDensity: crowdData.marketingAreaDensity || 0,
    eventDensity: crowdData.eventDensity || 0,
    trafficJunctionCount: crowdData.trafficJunctionCount || 0,
    hotspotsNearby: crowdData.hotspotsNearby || 0,
    estimatedCrowd: estimateCrowdLevel(crowdData.crowdDensityScore),
    available: crowdData.available,
  };
}

/**
 * Extract and structure hygiene factors independently
 */
function extractHygieneFactors(hygieneData) {
  return {
    hygieneScore: hygieneData.hygieneScore || 0,
    hygieneLevel: getHygieneLevel(hygieneData.hygieneScore),
    waterQuality: hygieneData.waterQuality || 'Unknown',
    sanitationFacilities: hygieneData.sanitationFacilities || 0,
    medicalServices: hygieneData.medicalServices || 0,
    wasteManagement: hygieneData.wasteManagement || 0,
    available: hygieneData.available,
  };
}

/**
 * Generate factor-wise independent reasoning (not generic scores)
 */
function generateFactorWiseReasoning(factors) {
  const reasons = [];

  // Air quality reasoning
  if (factors.airQuality.available) {
    if (factors.airQuality.aqi > 300) {
      reasons.push(`🚨 Air Quality HAZARDOUS - AQI ${factors.airQuality.aqi.toFixed(0)}`);
    } else if (factors.airQuality.aqi > 200) {
      reasons.push(`⚠️ Air Quality VERY UNHEALTHY - AQI ${factors.airQuality.aqi.toFixed(0)}`);
    } else if (factors.airQuality.aqi > 150) {
      reasons.push(`⚠️ Air Quality UNHEALTHY - AQI ${factors.airQuality.aqi.toFixed(0)}`);
    } else if (factors.airQuality.aqi > 100) {
      reasons.push(`⚠️ Air Quality UNHEALTHY FOR SENSITIVE GROUPS - AQI ${factors.airQuality.aqi.toFixed(0)}`);
    } else if (factors.airQuality.aqi > 50) {
      reasons.push(`✓ Air Quality MODERATE - AQI ${factors.airQuality.aqi.toFixed(0)}`);
    } else {
      reasons.push(`✓ Air Quality GOOD - AQI ${factors.airQuality.aqi.toFixed(0)}`);
    }
  }

  // Pollution reasoning
  if (factors.pollution.available) {
    const pollutionWarnings = [];
    if (factors.pollution.pm25 > 55.4) pollutionWarnings.push(`PM2.5 UNSAFE (${factors.pollution.pm25.toFixed(1)} µg/m³)`);
    if (factors.pollution.pm10 > 154) pollutionWarnings.push(`PM10 UNHEALTHY (${factors.pollution.pm10.toFixed(1)} µg/m³)`);
    if (factors.pollution.no2 > 200) pollutionWarnings.push(`NO2 HIGH (${factors.pollution.no2.toFixed(1)} µg/m³)`);
    if (factors.pollution.o3 > 120) pollutionWarnings.push(`OZONE HIGH (${factors.pollution.o3.toFixed(1)} µg/m³)`);
    if (factors.pollution.co > 10) pollutionWarnings.push(`CO ELEVATED (${factors.pollution.co.toFixed(1)} mg/m³)`);
    
    if (pollutionWarnings.length > 0) {
      reasons.push(`⚠️ Pollution Concerns: ${pollutionWarnings.join(', ')}`);
    }
  }

  // Weather reasoning
  if (factors.weather.available) {
    if (factors.weather.humidity > 80) {
      reasons.push(`💧 VERY HIGH HUMIDITY (${factors.weather.humidity.toFixed(0)}%) - Pathogen transmission risk`);
    } else if (factors.weather.humidity > 60) {
      reasons.push(`💧 HIGH HUMIDITY (${factors.weather.humidity.toFixed(0)}%) - Moderate transmission risk`);
    }
    
    if (factors.weather.temperature >= 20 && factors.weather.temperature <= 35) {
      reasons.push(`🌡️ OPTIMAL VIRUS SURVIVAL - Temperature ${factors.weather.temperature.toFixed(1)}°C`);
    }
    
    if (factors.weather.windSpeed < 2) {
      reasons.push(`🌪️ LOW WIND SPEED (${factors.weather.windSpeed.toFixed(1)} m/s) - Poor dispersion of pollutants`);
    } else if (factors.weather.windSpeed > 10) {
      reasons.push(`✓ STRONG WINDS (${factors.weather.windSpeed.toFixed(1)} m/s) - Better pollutant dispersion`);
    }
    
    if (factors.weather.uvIndex < 3) {
      reasons.push(`☀️ LOW UV INDEX (${factors.weather.uvIndex.toFixed(1)}) - Pathogens survive longer`);
    }
    
    if (factors.weather.rainfall > 10) {
      reasons.push(`🌧️ HEAVY RAINFALL (${factors.weather.rainfall.toFixed(1)}mm) - Wet conditions increase risk`);
    }
  }

  // Crowd reasoning
  if (factors.crowdDensity.available) {
    if (factors.crowdDensity.crowdDensityScore > 70) {
      reasons.push(`👥 VERY HEAVY CROWD CONGESTION (Score: ${factors.crowdDensity.crowdDensityScore.toFixed(0)}) - High transmission risk`);
    } else if (factors.crowdDensity.crowdDensityScore > 50) {
      reasons.push(`👥 HEAVY CROWD CONGESTION (Score: ${factors.crowdDensity.crowdDensityScore.toFixed(0)}) - Elevated transmission risk`);
    } else if (factors.crowdDensity.crowdDensityScore > 30) {
      reasons.push(`👥 MODERATE CROWD DENSITY (Score: ${factors.crowdDensity.crowdDensityScore.toFixed(0)})`);
    }
    
    if (factors.crowdDensity.transportHubDensity > 5) {
      reasons.push(`🚆 MAJOR TRANSPORT HUB - High mobility increase`);
    }
    
    if (factors.crowdDensity.trafficJunctionCount > 10) {
      reasons.push(`🚗 HEAVY TRAFFIC JUNCTION - Congestion hotspot`);
    }
    
    if (factors.crowdDensity.hotspotsNearby > 3) {
      reasons.push(`🔥 MULTIPLE HOTSPOTS NEARBY - High-risk cluster area`);
    }
  }

  // Hygiene reasoning
  if (factors.hygiene.available) {
    if (factors.hygiene.hygieneScore < 30) {
      reasons.push(`🚫 POOR HYGIENE CONDITIONS (Score: ${factors.hygiene.hygieneScore.toFixed(0)}) - Critical sanitation issues`);
    } else if (factors.hygiene.hygieneScore < 50) {
      reasons.push(`⚠️ INADEQUATE HYGIENE (Score: ${factors.hygiene.hygieneScore.toFixed(0)}) - Sanitation concerns`);
    } else if (factors.hygiene.hygieneScore < 75) {
      reasons.push(`✓ MODERATE HYGIENE (Score: ${factors.hygiene.hygieneScore.toFixed(0)})`);
    } else {
      reasons.push(`✓ GOOD HYGIENE (Score: ${factors.hygiene.hygieneScore.toFixed(0)})`);
    }
  }

  return reasons;
}

/**
 * Calculate independent biosafety score per location
 */
function calculateIndependentBiosafetyScore(factors) {
  let totalWeight = 0;
  let weightedScore = 0;

  // Air quality weight
  if (factors.airQuality.available) {
    const normalized = normaliseAqiForRisk(factors.airQuality.aqi);
    weightedScore += normalized * 0.25;
    totalWeight += 0.25;
  }

  // Weather weight
  if (factors.weather.available) {
    const weatherRisk = factors.weather.riskModifier || 0;
    weightedScore += weatherRisk * 0.15;
    totalWeight += 0.15;
  }

  // Crowd density weight
  if (factors.crowdDensity.available) {
    weightedScore += factors.crowdDensity.crowdDensityScore * 0.35;
    totalWeight += 0.35;
  }

  // Hygiene weight
  if (factors.hygiene.available) {
    const hygieneInverse = 100 - factors.hygiene.hygieneScore;
    weightedScore += hygieneInverse * 0.15;
    totalWeight += 0.15;
  }

  // Pollution weight
  if (factors.pollution.available) {
    const pollutionScore = (
      (factors.pollution.pm25 > 0 ? Math.min(factors.pollution.pm25 / 55.4 * 100, 100) : 0) +
      (factors.pollution.no2 > 0 ? Math.min(factors.pollution.no2 / 200 * 100, 100) : 0) +
      (factors.pollution.o3 > 0 ? Math.min(factors.pollution.o3 / 120 * 100, 100) : 0)
    ) / 3;
    weightedScore += pollutionScore * 0.10;
    totalWeight += 0.10;
  }

  if (totalWeight === 0) return 0;
  return Math.min(100, (weightedScore / totalWeight));
}

/**
 * Helper functions for status and categorization
 */
function getAQICategory(aqi) {
  if (aqi <= 50) return 'GOOD';
  if (aqi <= 100) return 'MODERATE';
  if (aqi <= 150) return 'UNHEALTHY_FOR_SENSITIVE_GROUPS';
  if (aqi <= 200) return 'UNHEALTHY';
  if (aqi <= 300) return 'VERY_UNHEALTHY';
  return 'HAZARDOUS';
}

function getAQIHealthEffect(aqi) {
  if (aqi <= 50) return 'Air quality is satisfactory';
  if (aqi <= 100) return 'Air quality is acceptable';
  if (aqi <= 150) return 'Members of sensitive groups may experience health effects';
  if (aqi <= 200) return 'Some members of the general public may experience health effects';
  if (aqi <= 300) return 'Health alert: Everyone may begin to experience health effects';
  return 'Health alert: Everyone should avoid outdoor exertion';
}

function getPollutantStatus(value, pollutant) {
  if (value <= 0) return `${pollutant}: Not available`;
  if (pollutant === 'PM2.5') {
    if (value <= 12) return `${pollutant}: GOOD (${value.toFixed(1)} µg/m³)`;
    if (value <= 35.4) return `${pollutant}: MODERATE (${value.toFixed(1)} µg/m³)`;
    if (value <= 55.4) return `${pollutant}: UNHEALTHY (${value.toFixed(1)} µg/m³)`;
    return `${pollutant}: HAZARDOUS (${value.toFixed(1)} µg/m³)`;
  }
  if (pollutant === 'PM10') {
    if (value <= 54) return `${pollutant}: GOOD (${value.toFixed(1)} µg/m³)`;
    if (value <= 154) return `${pollutant}: MODERATE (${value.toFixed(1)} µg/m³)`;
    return `${pollutant}: HAZARDOUS (${value.toFixed(1)} µg/m³)`;
  }
  if (pollutant === 'NO2') {
    if (value <= 40) return `${pollutant}: GOOD (${value.toFixed(1)} µg/m³)`;
    if (value <= 90) return `${pollutant}: MODERATE (${value.toFixed(1)} µg/m³)`;
    return `${pollutant}: UNHEALTHY (${value.toFixed(1)} µg/m³)`;
  }
  return `${pollutant}: ${value.toFixed(1)} detected`;
}

function getTemperatureStatus(temp) {
  if (temp >= 20 && temp <= 35) return 'OPTIMAL_VIRUS_SURVIVAL';
  if (temp >= 15 && temp <= 40) return 'FAVORABLE_CONDITIONS';
  return 'REDUCED_VIRUS_ACTIVITY';
}

function getHumidityStatus(humidity) {
  if (humidity > 80) return 'VERY_HIGH_TRANSMISSION_RISK';
  if (humidity > 60) return 'HIGH_TRANSMISSION_RISK';
  if (humidity < 30) return 'LOW_TRANSMISSION_RISK';
  return 'MODERATE_TRANSMISSION_RISK';
}

function getWindStatus(windSpeed) {
  if (windSpeed < 2) return 'POOR_DISPERSION';
  if (windSpeed > 10) return 'GOOD_DISPERSION';
  return 'MODERATE_DISPERSION';
}

function getUVStatus(uvIndex) {
  if (uvIndex < 3) return 'LOW_UV_PROTECTION';
  if (uvIndex > 8) return 'HIGH_UV_PROTECTION';
  return 'MODERATE_UV_PROTECTION';
}

function getCongestionLevel(score) {
  if (score > 70) return 'VERY_HEAVY';
  if (score > 50) return 'HEAVY';
  if (score > 30) return 'MODERATE';
  return 'LIGHT';
}

function estimateCrowdLevel(score) {
  if (score > 80) return '5000+';
  if (score > 60) return '2000-5000';
  if (score > 40) return '500-2000';
  if (score > 20) return '100-500';
  return '<100';
}

function getHygieneLevel(score) {
  if (score >= 75) return 'EXCELLENT';
  if (score >= 50) return 'GOOD';
  if (score >= 30) return 'POOR';
  return 'VERY_POOR';
}

function getRiskLevel(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

function getRiskColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#eab308';
  return '#22c55e';
}

export { getAQICategory, getPollutantStatus, getTemperatureStatus };
