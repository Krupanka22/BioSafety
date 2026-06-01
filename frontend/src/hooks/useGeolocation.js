import { useState, useEffect, useRef } from 'react';

/**
 * useGeolocation Hook — Watches the user's GPS position.
 * Returns the current lat/lng with loading and error states.
 */
export function useGeolocation(options = {}) {
  const [position, setPosition] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: true,
    error: null,
  });

  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPosition((prev) => ({
        ...prev,
        loading: false,
        error: 'Geolocation not supported by your browser',
      }));
      return;
    }

    const onSuccess = (pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        loading: false,
        error: null,
      });
    };

    const onError = (err) => {
      setPosition((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    };

    const geoOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 60000,
    };

    // Get initial position
    navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);

    // Watch for position changes if requested
    if (options.watch !== false) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        geoOptions
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return position;
}

export default useGeolocation;
