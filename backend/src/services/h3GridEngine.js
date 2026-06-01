import h3 from 'h3-js';

/**
 * H3 Grid Engine — Hexagonal spatial indexing at ~1km resolution.
 * Resolution 8 ≈ 0.74 km² per hex (roughly 1km edge-to-edge).
 */

const H3_RESOLUTION = 8;
/** Average hex edge length at res 8 (~km) */
const HEX_EDGE_KM = 0.461354684;

const MONITOR_RADIUS_KM = parseFloat(process.env.MONITOR_RADIUS_KM) || 5;
const MAX_HEX_CELLS = parseInt(process.env.MAX_HEX_CELLS, 10) || 200;

/**
 * Get the H3 index for a lat/lng at our standard resolution.
 */
export function latLngToH3(lat, lng) {
  return h3.latLngToCell(lat, lng, H3_RESOLUTION);
}

/**
 * Get the center [lat, lng] of an H3 hex.
 */
export function getHexCenter(h3Index) {
  const [lat, lng] = h3.cellToLatLng(h3Index);
  return { lat, lng };
}

/**
 * Get the polygon boundary of an H3 hex as an array of [lat, lng] pairs.
 * Suitable for drawing on a Leaflet map.
 */
export function getHexBoundary(h3Index) {
  const boundary = h3.cellToBoundary(h3Index);
  // h3 returns [lat, lng] pairs — Leaflet also uses [lat, lng]
  return boundary.map(([lat, lng]) => [lat, lng]);
}

/**
 * H3 ring count to approximate a ground radius in km.
 */
export function getRingsForRadiusKm(radiusKm = MONITOR_RADIUS_KM) {
  const rings = Math.ceil(radiusKm / (Math.sqrt(3) * HEX_EDGE_KM));
  return Math.max(1, Math.min(rings, 15));
}

export function getMonitorRadiusKm() {
  return MONITOR_RADIUS_KM;
}

/**
 * Grid covering ~MONITOR_RADIUS_KM (default 5km) around a point.
 */
export function getGridForRadius(lat, lng, radiusKm = MONITOR_RADIUS_KM) {
  const rings = getRingsForRadiusKm(radiusKm);
  return getGridForLocation(lat, lng, rings);
}

/**
 * Generate a disk of H3 hexes around a center point.
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} rings - Number of hex rings
 * @returns {Array<{h3Index: string, lat: number, lng: number, boundary: number[][]}>}
 */
export function getGridForLocation(lat, lng, rings = null) {
  if (rings == null) rings = getRingsForRadiusKm();
  const centerHex = latLngToH3(lat, lng);
  let hexIndexes = h3.gridDisk(centerHex, rings);
  if (hexIndexes.length > MAX_HEX_CELLS) {
    hexIndexes = hexIndexes.slice(0, MAX_HEX_CELLS);
  }

  return hexIndexes.map((h3Index) => {
    const center = getHexCenter(h3Index);
    const boundary = getHexBoundary(h3Index);
    return {
      h3Index,
      lat: center.lat,
      lng: center.lng,
      boundary,
    };
  });
}

/**
 * Get neighboring hexes around a given hex.
 */
export function getNearbyHexes(h3Index, rings = 1) {
  return h3.gridDisk(h3Index, rings);
}

/**
 * Get the bounding box for an H3 hex (for API queries).
 */
export function getHexBbox(h3Index) {
  const boundary = h3.cellToBoundary(h3Index);
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const [lat, lng] of boundary) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, west, north, east };
}

/**
 * Get the area of a hex in square kilometres.
 */
export function getHexAreaKm2() {
  return h3.getHexagonAreaAvg(H3_RESOLUTION, 'km2');
}

/**
 * Get H3 resolution being used.
 */
export function getResolution() {
  return H3_RESOLUTION;
}

export default {
  latLngToH3,
  getHexCenter,
  getHexBoundary,
  getGridForLocation,
  getGridForRadius,
  getRingsForRadiusKm,
  getMonitorRadiusKm,
  getNearbyHexes,
  getHexBbox,
  getHexAreaKm2,
  getResolution,
};
