/**
 * Generate human-readable biosafety reasoning unique to each coordinate / H3 cell.
 */

function crowdLabel(score) {
  if (score == null) return 'unknown';
  if (score >= 70) return 'very high';
  if (score >= 50) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

function aqiLabel(raw) {
  if (raw == null) return 'unknown';
  if (raw > 200) return 'hazardous';
  if (raw > 100) return 'unhealthy';
  if (raw > 50) return 'moderate';
  return 'good';
}

/**
 * @param {{ lat: number, lng: number, breakdown: object, biosafetyScore: number, riskLevel: string }} cell
 */
export function buildLocationReasoning(cell) {
  const b = cell.breakdown || {};
  const parts = [];

  if (b.aqi?.available && b.aqi.raw != null) {
    parts.push(`AQI ${b.aqi.raw} (${aqiLabel(b.aqi.raw)}) at ${cell.lat?.toFixed(4)}, ${cell.lng?.toFixed(4)}`);
  }
  if (b.weather?.available) {
    parts.push(
      `${b.weather.condition || 'Weather'} ${b.weather.temp ?? '—'}°C, ${b.weather.humidity ?? '—'}% humidity`
    );
  }
  if (b.crowdDensity?.available) {
    parts.push(`crowd ${crowdLabel(b.crowdDensity.score)} (score ${b.crowdDensity.score})`);
    const hubs = b.crowdDensity.infrastructure?.transportHubs || 0;
    if (hubs > 0) parts.push(`${hubs} transport hub(s) nearby`);
  }
  if (b.hygiene?.available) {
    parts.push(`hygiene index ${b.hygiene.score}/100`);
  }

  const summary =
    parts.length > 0
      ? parts.join(' · ')
      : `Limited live data at ${cell.lat?.toFixed(4)}, ${cell.lng?.toFixed(4)}`;

  return {
    summary,
    riskLevel: cell.riskLevel,
    biosafetyScore: cell.biosafetyScore,
    coordinates: { lat: cell.lat, lng: cell.lng },
    factors: {
      aqi: b.aqi?.raw ?? null,
      weather: b.weather?.condition ?? null,
      crowd: b.crowdDensity?.score ?? null,
      hygiene: b.hygiene?.score ?? null,
    },
  };
}

export default { buildLocationReasoning };
