/**
 * resolveWaypoints(chatcodes: string[]) → Map of chat_code → { name, wiki }
 * Dynamically crawls POIs by map/floor/continent to get live waypoint names.
 * Lightweight, zero static files.
 */

export async function resolveWaypoints(chatcodes = []) {
  const uniqueCodes = [...new Set(chatcodes.map(c => c.trim()).filter(Boolean))];
  const waypointMap = {};
  const result = {};

  if (uniqueCodes.length === 0) return result;

  const continents = [1, 2]; // Tyria, Mists of Pandaria

  try {
    // Step 1: Fetch continent metadata to get floors info
    const continentMeta = await Promise.all(
      continents.map(id =>
        fetch(`https://api.guildwars2.com/v2/continents/${id}`).then(r => r.json())
      )
    );

    // Step 2: Fetch floors data for each continent (limit floors if desired)
    const floorFetches = continentMeta.map((cMeta, i) => {
      const floorIds = Array.isArray(cMeta.floors) ? cMeta.floors : [];
      const ids = floorIds.join(','); // fetch all floors
      return fetch(`https://api.guildwars2.com/v2/continents/${continents[i]}/floors?ids=${ids}`)
        .then(r => r.json())
        .catch(() => []);
    });

    const allFloorsArrays = await Promise.all(floorFetches);
    const allFloors = allFloorsArrays.flat();

    // Step 3: Iterate floors → regions → maps → POIs
    for (const floor of allFloors) {
      const regions = Array.isArray(floor?.regions) ? floor.regions : [];
      for (const region of regions) {
        const maps = Array.isArray(region?.maps) ? region.maps : [];
        for (const map of maps) {
          const pois = Array.isArray(map?.points_of_interest) ? map.points_of_interest : [];
          for (const poi of pois) {
            if (
              poi?.type === "waypoint" &&
              typeof poi.chat_link === "string" &&
              poi.chat_link.trim() &&
              uniqueCodes.includes(poi.chat_link.trim()) &&
              typeof poi.name === "string"
            ) {
              waypointMap[poi.chat_link.trim()] = {
                name: poi.name,
                wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(poi.name.replace(/ /g, '_'))}`
              };
            }
          }
        }
      }
    }

    // Build final result object for each requested chat code
    uniqueCodes.forEach(code => {
      result[code] = waypointMap[code] || null;
    });

    return result;
  } catch (err) {
    console.error("Waypoint resolution failed:", err);
    // Return null for each requested code on failure
    return Object.fromEntries(uniqueCodes.map(code => [code, null]));
  }
}
