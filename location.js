/**
 * Location Module
 * Handles geolocation and reverse geocoding for location display.
 */

const LocationUtils = (() => {
    // Cache for location data
    let cachedPosition = null;
    let cachedAddress = null;
    let locationPermission = 'prompt'; // 'granted', 'denied', 'prompt'

    /**
     * Get current position with caching
     * @param {boolean} forceRefresh - Force a new location check
     * @returns {Promise<{latitude: number, longitude: number, accuracy: number} | null>}
     */
    async function getCurrentPosition(forceRefresh = false) {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            return null;
        }

        // Return cached position if available and not forcing refresh
        if (cachedPosition && !forceRefresh) {
            return cachedPosition;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    locationPermission = 'granted';
                    cachedPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    resolve(cachedPosition);
                },
                (error) => {
                    console.warn('Geolocation error:', error.message);
                    locationPermission = error.code === 1 ? 'denied' : 'prompt';
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000 // Cache for 1 minute
                }
            );
        });
    }

    /**
     * Reverse geocode coordinates to an approximate address
     * Uses OpenStreetMap Nominatim (free, no API key required)
     * @param {number} latitude 
     * @param {number} longitude 
     * @returns {Promise<string | null>}
     */
    async function reverseGeocode(latitude, longitude) {
        // Check cache first
        const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        if (cachedAddress && cachedAddress.key === cacheKey) {
            return cachedAddress.address;
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'RealPic-Lite/1.0'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Build a concise address from the response
            const address = buildConciseAddress(data);

            // Cache the result
            cachedAddress = { key: cacheKey, address };

            return address;
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
            // Return coordinates as fallback
            return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
        }
    }

    /**
     * Build a concise, readable address from Nominatim response
     * @param {Object} data - Nominatim response
     * @returns {string}
     */
    function buildConciseAddress(data) {
        if (!data || !data.address) {
            return data?.display_name || 'Unknown location';
        }

        const addr = data.address;
        const parts = [];

        // Get neighborhood/suburb/district
        const area = addr.neighbourhood || addr.suburb || addr.district || addr.borough;
        if (area) parts.push(area);

        // Get city/town/village
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county;
        if (city && city !== area) parts.push(city);

        // Get state/region (abbreviate if possible)
        const state = addr.state || addr.region || addr.province;
        if (state && state !== city) {
            // Try to use abbreviated form for known states
            const abbrev = abbreviateState(state);
            parts.push(abbrev);
        }

        // Get country code (use 2-letter code for brevity)
        if (addr.country_code) {
            parts.push(addr.country_code.toUpperCase());
        }

        // Fallback to display_name if we couldn't build anything
        if (parts.length === 0) {
            return data.display_name?.split(',').slice(0, 3).join(', ') || 'Unknown';
        }

        return parts.join(', ');
    }

    /**
     * Abbreviate common state names
     * @param {string} state 
     * @returns {string}
     */
    function abbreviateState(state) {
        const abbreviations = {
            // US States
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
            'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
            'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
            'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
            'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
            'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
            'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
            'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
            'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
            'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
            'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
            // Canadian Provinces
            'Ontario': 'ON', 'Quebec': 'QC', 'British Columbia': 'BC', 'Alberta': 'AB',
            'Manitoba': 'MB', 'Saskatchewan': 'SK', 'Nova Scotia': 'NS', 'New Brunswick': 'NB',
            'Newfoundland and Labrador': 'NL', 'Prince Edward Island': 'PE'
        };
        return abbreviations[state] || state;
    }

    /**
     * Get location data formatted for watermark display
     * @returns {Promise<{coords: string, address: string} | null>}
     */
    async function getLocationForWatermark() {
        const position = await getCurrentPosition();
        if (!position) return null;

        const address = await reverseGeocode(position.latitude, position.longitude);

        return {
            coords: `${position.latitude.toFixed(6)},${position.longitude.toFixed(6)}`,
            address: address,
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy
        };
    }

    /**
     * Check if location permission has been granted
     * @returns {string} 'granted', 'denied', or 'prompt'
     */
    function getPermissionStatus() {
        return locationPermission;
    }

    /**
     * Request location permission by triggering a geolocation request
     * @returns {Promise<boolean>}
     */
    async function requestPermission() {
        const position = await getCurrentPosition(true);
        return position !== null;
    }

    /**
     * Clear cached location data
     */
    function clearCache() {
        cachedPosition = null;
        cachedAddress = null;
    }

    /**
     * Format coordinates for display
     * @param {number} latitude 
     * @param {number} longitude 
     * @returns {string}
     */
    function formatCoordinates(latitude, longitude) {
        const latDir = latitude >= 0 ? 'N' : 'S';
        const lonDir = longitude >= 0 ? 'E' : 'W';
        return `${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lonDir}`;
    }

    return {
        getCurrentPosition,
        reverseGeocode,
        getLocationForWatermark,
        getPermissionStatus,
        requestPermission,
        clearCache,
        formatCoordinates
    };
})();
