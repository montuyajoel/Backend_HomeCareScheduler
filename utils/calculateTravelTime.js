const axios = require('axios');
const { logExternal } = require('../middleware/logger');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

async function computeTravelTime(origin, destination, travelMode = 'DRIVE') {
  const startTime = Date.now();
  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  const payload = {
    origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
    destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
    travelMode,
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    'X-Goog-Api-Key': GOOGLE_API_KEY,
  };

  try {
    const response = await axios.post(url, payload, { headers });
    const durationMs = Date.now() - startTime;
    const route = response.data.routes?.[0];

    if (!route) {
      logExternal('GoogleRoutes', 'No route returned from API', 400, durationMs);
      throw new Error('No route returned from Google Routes API');
    }

    const durationSeconds = parseInt(route.duration, 10);
    const durationMinutes = Number.isNaN(durationSeconds) ? null : Math.round((durationSeconds / 60) * 100) / 100;
    const distanceKM = typeof route.distanceMeters === 'number' ? Math.round((route.distanceMeters / 1000) * 100) / 100 : null;

    logExternal('GoogleRoutes', `Route calculated: ${distanceKM} km, ${durationMinutes} mins (${travelMode})`, response.status, durationMs);

    return { durationMinutes, distanceKM, mode: travelMode, raw: response.data };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error.response?.data?.error?.message || error.message;
    const status = error.response?.status || 'FAILED';

    logExternal('GoogleRoutes', `Error: ${errorMsg}`, status, durationMs);
    throw new Error(errorMsg);
  }
}

module.exports = computeTravelTime;
