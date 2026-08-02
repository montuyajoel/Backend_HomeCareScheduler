// utils/geocodeAddress.js
/*Admin never sees or types latitude/longitude, they only need to fill in the five text fields
(Address Line, Town, City, County, Post Code),
and the backend converts that into coordinates before saving.*/

const AXIOS = require("axios");
const { logExternal } = require("../middleware/logger");
const GEOCODE_PROVIDER_URL = process.env.GEOCODE_API_URL || "https://nominatim.openstreetmap.org/search";
const GEOCODE_USER_AGENT = process.env.GEOCODE_USER_AGENT || "HomeCareScheduler/1.0";

async function geocodeStructuredAddress({ addressLine, town, city, county, postCode }) {
    const startTime = Date.now();
    const addressStr = [addressLine, town, city, county, postCode].filter(Boolean).join(", ");
    try {
        const response = await AXIOS.get(GEOCODE_PROVIDER_URL, {
            params: {
                street: addressLine,
                town: town,
                city: city,
                county: county,
                postalcode: postCode,
                format: "json",
                limit: 1,
            },
            headers: { "User-Agent": GEOCODE_USER_AGENT },
        });

        const durationMs = Date.now() - startTime;

        if (!response.data || response.data.length === 0) {
            logExternal('NominatimGeocode', `Address not found: "${addressStr}"`, 404, durationMs);
            throw new Error("Address could not be located. Please check the address details and try again.");
        }

        const result = {
            latitude: parseFloat(response.data[0].lat),
            longitude: parseFloat(response.data[0].lon),
        };
        // Log request info
        logExternal('NominatimGeocode', `Geocoded "${addressStr}" -> (${result.latitude}, ${result.longitude})`, response.status, durationMs);

        return result;
    } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMsg = error.response?.data?.message || error.message;
        const status = error.response?.status || 'FAILED';

        logExternal('NominatimGeocode', `Error: ${errorMsg}`, status, durationMs);
        throw error;
    }
}

module.exports = geocodeStructuredAddress;