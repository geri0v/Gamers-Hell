/**
 * waypoint.js
 * Dynamically resolves waypoint chat codes like [&BNIEAAA=] to real names and wiki links
 * Uses live data from /v2/continents and /floors – no static files required
 * Intended for use inside `infoload.js` or enrichment layer
 */

export async function resolveWaypoints(chatcodes = []) {
  const uniqueCodes = [...new Set(chatcodes.map(c => c.trim()).filter(Boolean))];
  const result = {};

  if (uniqueCodes.length === 0) return result;

  const continents = [1, 2]; // Tyria, Mists
  const waypointMap = {};

  try {
    // Step 1: Get continent floors
    const continentFloors = await Promise.all(
      continents.map(c => fetch(`https://api.guildwars2.com/v2/continents/${c}`).then(r => r.json()))
    );

    const fetchFloors = [];

    for (let i = 0; i < continents.length; i++) {
      const floors = continentFloors[i].floors || [];
      fetchFloors.push(
        fetch(`https://api.guildwars2.com/v2/continents/${continents[i]}/floors?ids=${floors.join(',')}`)
          .then(r => r.json())
          .catch(() => [])
      );
    }

    // Step 2: Fetch all floor data
    const allFloors = await Promise.all(fetchFloors);
    const flattenedFloors = allFloors.flat(1);

    // Step 3: Crawl regions → maps → POIs to match waypoints
    flattenedFloors.forEach(floor => {
      const regions = floor?.regions || {};
      Object.values(regions).forEach(region => {
        const maps = region?.maps || {};
        Object.values(maps).forEach(subMap => {
          const pois = subMap?.points_of_interest || {};
          Object.values(pois).forEach(poi => {
            if (poi?.type === 'waypoint' && poi.chat_link && poi.name) {
              waypointMap[poi.chat_link.trim()] = {
                name: poi.name,
                wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(poi.name.replace(/ /g, "_"))}`
              };
            }
          });
        });
      });
    });

    // Step 4: Match only requested chatcodes
    uniqueCodes.forEach(code => {
      result[code] = waypointMap[code] || null;
    });

    return result;

  } catch (err) {
    console.error("Waypoint resolution failed:", err);
    return {};
  }
}
