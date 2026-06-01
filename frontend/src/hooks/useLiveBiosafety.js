import { useEffect, useRef } from 'react';
import { useGeolocation } from './useGeolocation';
import { subscribeLocation } from '../services/socketService';

const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;
/**
 * Subscribes to live biosafety data for the user's location (or fallback).
 * Omit rings to let the backend use MONITOR_RADIUS_KM (~5km).
 * Re-subscribes when position moves meaningfully (~500m).
 */
export function useLiveBiosafety({ rings = null, watch = true } = {}) {
  const geo = useGeolocation({ watch, enableHighAccuracy: true });
  const lastSubRef = useRef(null);

  const lat = geo.latitude ?? DEFAULT_LAT;
  const lng = geo.longitude ?? DEFAULT_LNG;

  useEffect(() => {
    const key = `${lat.toFixed(3)}:${lng.toFixed(3)}:${rings ?? 'auto'}`;
    if (lastSubRef.current === key) return;
    lastSubRef.current = key;
    subscribeLocation(lat, lng, rings ?? undefined);
  }, [lat, lng, rings]);

  return {
    lat,
    lng,
    geoLoading: geo.loading,
    geoError: geo.error,
    accuracy: geo.accuracy,
  };
}

export default useLiveBiosafety;
