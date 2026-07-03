/**
 * Location Module - Handles GPS geolocation capture
 */
const LocationModule = (() => {
  let watchId = null;
  let currentPosition = null;
  let callbacks = [];

  /**
   * Start watching GPS position
   */
  function startWatching() {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        currentPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        callbacks.forEach(cb => cb(currentPosition));
      },
      (error) => {
        console.warn('GPS error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  /**
   * Get current position (one-time)
   */
  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          currentPosition = pos;
          resolve(pos);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Register a callback for position updates
   */
  function onPosition(callback) {
    callbacks.push(callback);
    if (currentPosition) {
      callback(currentPosition);
    }
  }

  /**
   * Stop watching GPS
   */
  function stopWatching() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  /**
   * Get the latest known position
   */
  function getLatestPosition() {
    return currentPosition;
  }

  /**
   * Format coordinates for display
   */
  function formatCoords(position) {
    if (!position) return 'Location unavailable';
    return `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
  }

  /**
   * Get Google Maps link
   */
  function getMapsLink(position) {
    if (!position) return '#';
    return `https://www.google.com/maps?q=${position.latitude},${position.longitude}`;
  }

  return {
    startWatching,
    getCurrentPosition,
    onPosition,
    stopWatching,
    getLatestPosition,
    formatCoords,
    getMapsLink
  };
})();
