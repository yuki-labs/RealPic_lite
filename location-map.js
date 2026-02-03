/**
 * Location Map Component
 * Displays an interactive map for shared photos/videos with location data.
 * Uses OpenStreetMap tiles (no API key required).
 */

const LocationMap = (() => {
    // Map state
    let mapContainer = null;
    let mapInitialized = false;
    let coordinates = null;

    /**
     * Parse location data from watermark message
     * @param {string} watermarkData - The decoded watermark data
     * @returns {Object|null} Location data or null
     */
    function parseLocationFromWatermark(watermarkData) {
        if (!watermarkData) return null;

        const result = {
            coords: null,
            latitude: null,
            longitude: null,
            address: null
        };

        // Parse coordinates (format: "Location: lat,lng")
        const coordsMatch = watermarkData.match(/Location:\s*([-\d.]+)\s*,\s*([-\d.]+)/);
        if (coordsMatch) {
            result.latitude = parseFloat(coordsMatch[1]);
            result.longitude = parseFloat(coordsMatch[2]);
            result.coords = `${result.latitude},${result.longitude}`;
        }

        // Parse address (format: "Address: ...")
        const addressMatch = watermarkData.match(/Address:\s*([^|]+)/);
        if (addressMatch) {
            result.address = addressMatch[1].trim();
        }

        // Only return if we have coordinates
        if (result.latitude !== null && result.longitude !== null) {
            return result;
        }
        return null;
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

    /**
     * Create the map container HTML
     * @param {Object} location - Location data
     * @returns {HTMLElement}
     */
    function createMapElement(location) {
        const container = document.createElement('div');
        container.className = 'location-map-section';
        container.id = 'locationMapSection';

        const header = document.createElement('div');
        header.className = 'location-map-header';
        header.innerHTML = `
            <div class="location-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </div>
            <div class="location-info">
                <span class="location-label">Photo Location</span>
                <span class="location-address">${location.address || formatCoordinates(location.latitude, location.longitude)}</span>
            </div>
        `;

        const mapWrapper = document.createElement('div');
        mapWrapper.className = 'location-map-wrapper';
        mapWrapper.id = 'locationMapWrapper';

        // Create an iframe with OpenStreetMap embed
        const mapFrame = document.createElement('iframe');
        mapFrame.className = 'location-map-frame';
        mapFrame.id = 'locationMapFrame';
        mapFrame.width = '100%';
        mapFrame.height = '200';
        mapFrame.frameBorder = '0';
        mapFrame.scrolling = 'no';
        mapFrame.loading = 'lazy';

        // Use OpenStreetMap embed URL
        const zoomLevel = 14;
        const bbox = calculateBbox(location.latitude, location.longitude, zoomLevel);
        mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${location.latitude},${location.longitude}`;

        mapWrapper.appendChild(mapFrame);

        // Add view larger map link
        const mapLinks = document.createElement('div');
        mapLinks.className = 'location-map-links';
        mapLinks.innerHTML = `
            <a href="https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=${zoomLevel}/${location.latitude}/${location.longitude}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="map-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View Larger Map
            </a>
            <a href="https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="map-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                Open in Google Maps
            </a>
        `;

        container.appendChild(header);
        container.appendChild(mapWrapper);
        container.appendChild(mapLinks);

        return container;
    }

    /**
     * Calculate bounding box for OpenStreetMap embed
     * @param {number} lat 
     * @param {number} lng 
     * @param {number} zoom 
     * @returns {string}
     */
    function calculateBbox(lat, lng, zoom) {
        // Calculate approximate bbox for the given zoom level
        const latDelta = 0.01 * Math.pow(2, 14 - zoom);
        const lngDelta = 0.02 * Math.pow(2, 14 - zoom);

        const minLng = lng - lngDelta;
        const minLat = lat - latDelta;
        const maxLng = lng + lngDelta;
        const maxLat = lat + latDelta;

        return `${minLng},${minLat},${maxLng},${maxLat}`;
    }

    /**
     * Initialize the map with location data
     * @param {string} watermarkData - Decoded watermark data string
     * @param {HTMLElement} parentElement - Element to insert the map after
     * @returns {boolean} Whether the map was created
     */
    function initFromWatermark(watermarkData, parentElement) {
        if (mapInitialized) return false;

        const location = parseLocationFromWatermark(watermarkData);
        if (!location) {
            console.log('No location data found in watermark');
            return false;
        }

        coordinates = location;
        const mapElement = createMapElement(location);

        // Insert after the parent element
        if (parentElement && parentElement.parentNode) {
            parentElement.parentNode.insertBefore(mapElement, parentElement.nextSibling);
            mapContainer = mapElement;
            mapInitialized = true;
            console.log('Location map initialized:', location.address || `${location.latitude}, ${location.longitude}`);
            return true;
        }

        return false;
    }

    /**
     * Check if map is currently displayed
     * @returns {boolean}
     */
    function isDisplayed() {
        return mapInitialized;
    }

    /**
     * Get the current coordinates
     * @returns {Object|null}
     */
    function getCoordinates() {
        return coordinates;
    }

    /**
     * Remove the map from the DOM
     */
    function destroy() {
        if (mapContainer && mapContainer.parentNode) {
            mapContainer.parentNode.removeChild(mapContainer);
        }
        mapContainer = null;
        mapInitialized = false;
        coordinates = null;
    }

    return {
        parseLocationFromWatermark,
        formatCoordinates,
        initFromWatermark,
        isDisplayed,
        getCoordinates,
        destroy
    };
})();
