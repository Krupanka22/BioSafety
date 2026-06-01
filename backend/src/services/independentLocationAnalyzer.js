import axios from 'axios';
import logger from '../utils/logger.js';
import { getGridForRadius } from './h3GridEngine.js';

/**
 * Independent Location Analyzer
 * Generates and categorizes monitoring points: hotspots, transport hubs, junctions, crowded areas
 * Each location fetches its own data independently
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

/**
 * Generate strategic monitoring points including:
 * - Hotspots (high-risk areas)
 * - Transport hubs
 * - Traffic junctions
 * - Crowded areas
 * - Market/commercial areas
 */
export async function generateIndependentMonitoringPoints(centerLat, centerLng, radiusKm = 5) {
  const points = [];

  try {
    // 1. Get H3 grid cells as base monitoring points
    const gridCells = getGridForRadius(centerLat, centerLng, radiusKm);
    
    for (const cell of gridCells) {
      points.push({
        lat: cell.lat,
        lng: cell.lng,
        type: 'GRID_CELL',
        h3Index: cell.h3Index,
        label: `Grid Cell ${cell.h3Index.slice(0, 8)}`,
      });
    }

    // 2. Fetch and add transport hubs independently
    const transportHubs = await fetchTransportHubsIndependently(centerLat, centerLng, radiusKm);
    points.push(...transportHubs);

    // 3. Fetch and add traffic junctions independently
    const junctions = await fetchTrafficJunctionsIndependently(centerLat, centerLng, radiusKm);
    points.push(...junctions);

    // 4. Fetch and add crowded areas independently
    const crowdedAreas = await fetchCrowdedAreasIndependently(centerLat, centerLng, radiusKm);
    points.push(...crowdedAreas);

    logger.info(`Generated ${points.length} independent monitoring points within ${radiusKm}km`);
    return points;
  } catch (error) {
    logger.error('Error generating monitoring points:', error);
    // Return grid cells as fallback
    const gridCells = getGridForRadius(centerLat, centerLng, radiusKm);
    return gridCells.map(cell => ({
      lat: cell.lat,
      lng: cell.lng,
      type: 'GRID_CELL',
      h3Index: cell.h3Index,
      label: `Grid Cell ${cell.h3Index.slice(0, 8)}`,
    }));
  }
}

/**
 * Fetch transport hubs independently
 */
async function fetchTransportHubsIndependently(centerLat, centerLng, radiusKm) {
  const hubs = [];
  
  try {
    const overpassQuery = `
      [bbox:${centerLat - radiusKm/111}
           ,${centerLng - radiusKm/(111*Math.cos(centerLat*Math.PI/180))}
           ,${centerLat + radiusKm/111}
           ,${centerLng + radiusKm/(111*Math.cos(centerLat*Math.PI/180))}];
      (
        node["amenity"="bus_station"];
        node["amenity"="train_station"];
        node["amenity"="subway_entrance"];
        node["amenity"="ferry_terminal"];
        way["amenity"="bus_station"];
        way["amenity"="train_station"];
        way["amenity"="subway_entrance"];
        way["amenity"="ferry_terminal"];
      );
      out geom;
    `;

    const response = await axios.post(OVERPASS_URL, overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 10000,
    });

    const elements = response.data.elements || [];
    
    for (const element of elements) {
      if (element.lat && element.lon) {
        hubs.push({
          lat: element.lat,
          lng: element.lon,
          type: 'TRANSPORT_HUB',
          name: element.tags?.name || element.tags?.amenity || 'Transport Hub',
          label: `🚆 ${element.tags?.name || element.tags?.amenity || 'Transport Hub'}`,
          description: `${element.tags?.operator || ''} ${element.tags?.ref || ''}`.trim(),
        });
      } else if (element.type === 'way' && element.geometry) {
        const center = calculateWayCenter(element.geometry);
        hubs.push({
          lat: center.lat,
          lng: center.lng,
          type: 'TRANSPORT_HUB',
          name: element.tags?.name || element.tags?.amenity || 'Transport Hub',
          label: `🚆 ${element.tags?.name || element.tags?.amenity || 'Transport Hub'}`,
          description: `${element.tags?.operator || ''} ${element.tags?.ref || ''}`.trim(),
        });
      }
    }
  } catch (error) {
    logger.warn('Error fetching transport hubs:', error.message);
  }

  return hubs;
}

/**
 * Fetch traffic junctions independently
 */
async function fetchTrafficJunctionsIndependently(centerLat, centerLng, radiusKm) {
  const junctions = [];
  
  try {
    const overpassQuery = `
      [bbox:${centerLat - radiusKm/111}
           ,${centerLng - radiusKm/(111*Math.cos(centerLat*Math.PI/180))}
           ,${centerLat + radiusKm/111}
           ,${centerLng + radiusKm/(111*Math.cos(centerLat*Math.PI/180))}];
      (
        node["traffic_signals"="yes"];
        node["junction"="yes"];
        way["junction"];
        way["traffic_signals"="yes"];
      );
      out geom;
    `;

    const response = await axios.post(OVERPASS_URL, overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 10000,
    });

    const elements = response.data.elements || [];
    const junctionMap = new Map(); // Deduplicate nearby junctions
    
    for (const element of elements) {
      let lat, lng;
      if (element.lat && element.lon) {
        lat = element.lat;
        lng = element.lon;
      } else if (element.type === 'way' && element.geometry) {
        const center = calculateWayCenter(element.geometry);
        lat = center.lat;
        lng = center.lng;
      }

      if (lat && lng) {
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (!junctionMap.has(key)) {
          junctionMap.set(key, {
            lat,
            lng,
            type: 'TRAFFIC_JUNCTION',
            name: 'Traffic Junction',
            label: '🚦 Traffic Junction',
            description: element.tags?.description || 'Major intersection',
          });
        }
      }
    }

    junctions.push(...Array.from(junctionMap.values()));
  } catch (error) {
    logger.warn('Error fetching traffic junctions:', error.message);
  }

  return junctions;
}

/**
 * Fetch crowded areas independently (markets, malls, tourist spots, events)
 */
async function fetchCrowdedAreasIndependently(centerLat, centerLng, radiusKm) {
  const areas = [];
  
  try {
    const overpassQuery = `
      [bbox:${centerLat - radiusKm/111}
           ,${centerLng - radiusKm/(111*Math.cos(centerLat*Math.PI/180))}
           ,${centerLat + radiusKm/111}
           ,${centerLng + radiusKm/(111*Math.cos(centerLat*Math.PI/180))}];
      (
        node["shop"="mall"];
        node["shop"="supermarket"];
        node["amenity"="marketplace"];
        node["amenity"="food_court"];
        node["amenity"="cinema"];
        node["amenity"="theatre"];
        node["amenity"="stadium"];
        node["amenity"="community_centre"];
        node["tourism"="attraction"];
        node["tourism"="museum"];
        node["tourism"="zoo"];
        way["shop"="mall"];
        way["shop"="supermarket"];
        way["amenity"="marketplace"];
        way["amenity"="food_court"];
        way["amenity"="cinema"];
        way["amenity"="stadium"];
        way["tourism"="attraction"];
      );
      out geom;
    `;

    const response = await axios.post(OVERPASS_URL, overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 10000,
    });

    const elements = response.data.elements || [];
    
    for (const element of elements) {
      let lat, lng;
      if (element.lat && element.lon) {
        lat = element.lat;
        lng = element.lon;
      } else if (element.type === 'way' && element.geometry) {
        const center = calculateWayCenter(element.geometry);
        lat = center.lat;
        lng = center.lng;
      }

      if (lat && lng) {
        const category = element.tags?.shop || element.tags?.amenity || element.tags?.tourism || 'Area';
        areas.push({
          lat,
          lng,
          type: 'CROWDED_AREA',
          category,
          name: element.tags?.name || category,
          label: `👥 ${element.tags?.name || category}`,
          description: element.tags?.description || '',
        });
      }
    }
  } catch (error) {
    logger.warn('Error fetching crowded areas:', error.message);
  }

  return areas;
}

/**
 * Calculate center point of a way's geometry
 */
function calculateWayCenter(geometry) {
  if (!geometry || geometry.length === 0) {
    return { lat: 0, lng: 0 };
  }

  let sumLat = 0, sumLng = 0;
  for (const point of geometry) {
    sumLat += point.lat;
    sumLng += point.lon;
  }

  return {
    lat: sumLat / geometry.length,
    lng: sumLng / geometry.length,
  };
}

/**
 * Categorize a location based on its tags
 */
export function categorizeLocation(tags, osmData) {
  const categories = [];

  if (tags?.amenity) categories.push(tags.amenity);
  if (tags?.shop) categories.push(tags.shop);
  if (tags?.tourism) categories.push(tags.tourism);
  if (tags?.building) categories.push(tags.building);

  if (osmData?.transportHubs) categories.push('TRANSPORT_HUB');
  if (osmData?.crowdPlaces) categories.push('CROWDED_AREA');
  if (osmData?.trafficJunctions) categories.push('TRAFFIC_JUNCTION');

  return categories;
}

export {
    fetchCrowdedAreasIndependently, fetchTrafficJunctionsIndependently, fetchTransportHubsIndependently
};

