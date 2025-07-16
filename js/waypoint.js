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

  const continents = [1, 2]; // Tyria, Mists

  try {
    // Step 1: Fetch continent floor metadata
    const continentMeta = await Promise.all(
      continents.map(id =>
        fetch(`https://api.guildwars2.com/v2/continents/${id}`).then(r => r.json())
      )
    );

    // Step 2: Fetch floors data that lists maps and POIs
    const floorFetches = continentMeta.map((cMeta, i) => {
      const floorIds = cMeta.floors || [];
      const ids = floorIds.slice(0, 10).join(','); // limit for speed (you can extend)
      return fetch(`https://api.guildwars2.com/v2/continents/${continents[i]}/floors?ids=${ids}`)
        .then(r => r.json())
        .catch(() => []);
    });

    const allFloors = await Promise.all(floorFetches);
    const flatFloors = allFloors.flat();

    // Step 3: Crawl regions → maps → POIs in each floor
    for (const floor of flatFloors) {
      const regions = floor?.regions || {};
      for (const region of Object.values(regions)) {
        const maps = region?.maps || {};
        for (const subMap of Object.values(maps)) {
          const pois = subMap?.points_of_interest || {};
          for (const poi of Object.values(pois)) {
            const code = poi?.chat_link?.trim();
            if (poi?.type === "waypoint" && code && poi?.name && uniqueCodes.includes(code)) {
              waypointMap[code] = {
                name: poi.name,
                wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(poi.name.replace(/ /g, '_'))}`
              };
            }
          }
        }
      }
    }

    uniqueCodes.forEach(c => {
      result[c] = waypointMap[c] || null;
    });

    return result;
  } catch (err) {
    console.error("Waypoint resolution failed:", err);
    return Object.fromEntries(uniqueCodes.map(code => [code, null]));
  }
}
