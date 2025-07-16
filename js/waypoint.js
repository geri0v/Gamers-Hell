export async function resolveWaypoints(chatcodes = []) {
  const uniqueCodes = [...new Set(chatcodes.map(c => c.trim()).filter(Boolean))];
  const result = {};
  const waypointMap = {};
  const continents = [1, 2];

  try {
    const continentMeta = await Promise.all(
      continents.map(id => fetch(`https://api.guildwars2.com/v2/continents/${id}`).then(r => r.json()))
    );

    const floorFetches = [];
    continentMeta.forEach((continent, idx) => {
      const floorIds = continent?.floors || [];
      floorFetches.push(
        fetch(`https://api.guildwars2.com/v2/continents/${continents[idx]}/floors?ids=${floorIds.join(',')}`)
          .then(r => r.json())
          .catch(() => [])
      );
    });

    const allFloors = await Promise.all(floorFetches);
    const all = allFloors.flat(1);

    all.forEach(floor => {
      const regions = floor?.regions || {};
      Object.values(regions).forEach(region => {
        const maps = region?.maps || {};
        Object.values(maps).forEach(map => {
          const pois = map?.points_of_interest || {};
          Object.values(pois).forEach(poi => {
            if (poi?.type === "waypoint" && poi.chat_link && poi.name) {
              waypointMap[poi.chat_link.trim()] = {
                name: poi.name,
                wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(poi.name.replace(/ /g, "_"))}`
              };
            }
          });
        });
      });
    });

    uniqueCodes.forEach(code => {
      result[code] = waypointMap[code] || null;
    });

    return result;
  } catch (e) {
    console.error("Waypoint resolution error:", e);
    return uniqueCodes.reduce((acc, c) => {
      acc[c] = null;
      return acc;
    }, {});
  }
}
