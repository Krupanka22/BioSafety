import {
  fetchCrowdGridSnapshot,
  crowdSnapshotToOsmData,
  fetchCrowdForHex,
} from './crowdDensityService.js';
import { latLngToH3 } from './h3GridEngine.js';

/**
 * OSM geospatial facade — hygiene/POI data derived from shared crowd grid fetch.
 * Crowd scores come from crowdDensityService (Overpass, no API keys).
 */

export async function fetchPOIDataForBounds(bbox) {
  const lat = (bbox.south + bbox.north) / 2;
  const lng = (bbox.west + bbox.east) / 2;
  return fetchPOIDataForLocation(lat, lng, 0.6);
}

export async function fetchPOIDataForLocation(lat, lng) {
  const h3Index = latLngToH3(lat, lng);
  const crowd = await fetchCrowdForHex(h3Index, lat, lng);
  return crowdSnapshotToOsmData(
    { perHex: { [h3Index]: crowd }, amenities: [], available: crowd.available },
    h3Index
  );
}

/**
 * Prefetch geospatial data for an entire H3 grid (called once per pipeline cycle).
 */
export async function fetchPOIGridData(hexList) {
  const snapshot = await fetchCrowdGridSnapshot(hexList);
  return snapshot;
}

export function osmDataForHex(gridSnapshot, h3Index) {
  return crowdSnapshotToOsmData(gridSnapshot, h3Index);
}

export default {
  fetchPOIDataForBounds,
  fetchPOIDataForLocation,
  fetchPOIGridData,
  osmDataForHex,
};
