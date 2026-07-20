// utils/geocodeAddress.js
/*Admin never sees or types latitude/longitude, they only need to fill in the five text fields
(Address Line, Town, City, County, Post Code),
and the backend converts that into coordinates before saving.*/

const AXIOS = require("axios");
const GEOCODE_PROVIDER_URL = process.env.GEOCODE_API_URL || "https://nominatim.openstreetmap.org/search";
const GEOCODE_USER_AGENT = process.env.GEOCODE_USER_AGENT || "HomeCareScheduler/1.0";

async function geocodeStructuredAddress({ addressLine, town, city, county, postCode }) {
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

    if (!response.data || response.data.length === 0) {
        throw new Error("Address could not be located. Please check the address details and try again.");
    }

    return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon),
    };
}

module.exports = geocodeStructuredAddress;