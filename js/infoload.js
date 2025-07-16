import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichItemsAndPrices, fetchWikiDescription } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import { resolveWaypoints } from 'https://geri0v.github.io/Gamers-Hell/js/waypoint.js';

/**
 * Load and enrich all event data
 * @param {Function} onProgress optional callback
 * @returns {Promise<Array>} enriched metadata-ready event objects
 */
export async function loadAndEnrichData(onProgress = null) {
  const rawEvents = await fetchAllData();

  // Step 1: Collect item IDs
  const uniqueItemIds = new Set();
  rawEvents.forEach(event => {
    (event?.loot || []).forEach(item => item.id && uniqueItemIds.add(item.id));
  });

  // Step 2: Enrich items + prices (loot)
  const enrichedItems = await enrichItemsAndPrices([...uniqueItemIds]);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  // Step 3: Resolve waypoint names for all chatcodes
  const chatcodes = rawEvents
    .map(e => (e.chatcode || e.code || '').trim())
    .filter(code => code.length > 5);

  const waypointMap = await resolveWaypoints(chatcodes);

  // Step 4: Event-level enrichment
  const enriched = await Promise.all(
    rawEvents.map(async event => {
      const code = (event.chatcode || event.code || '').trim();
      const wp = waypointMap[code] || {};

      event.code = code;
      event.waypointName = wp.name || null;
      event.waypointWikiLink = wp.wiki || null;

      // Wiki Link for Event
      event.wikiLink = event.name
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, "_"))}}`
        : null;

      // Wiki Link for Map
      event.mapWikiLink = event.map
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, "_"))}`
        : null;

      // Description: Generate only 2 first sentences w/ fallback
      const desc = await fetchWikiDescription(event.name || wp.name || '');
      const match = desc?.match(/^(.+?[.!?])\s*(.+?[.!?])/);
      event.description = match ? `${match[1]} ${match[2]}` : desc;

      // Step 5: Enrich Loot
      event.loot = (event.loot || []).map(l => {
        const enriched = l.id ? itemMap.get(l.id) || {} : {};
        const name = enriched.name || l.name;
        const wikiLink = name
          ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`
          : null;

        return {
          ...l,
          name,
          icon: enriched.icon || null,
          wikiLink,
          accountBound: enriched.flags?.includes("AccountBound") || false,
          chatCode: enriched.chat_link || null,
          vendorValue: enriched.vendor_value ?? null,
          price: enriched.price ?? null,
          type: enriched.type ?? null,
          rarity: enriched.rarity || l.rarity || null,
          guaranteed: !!l.guaranteed
        };
      });

      if (onProgress) onProgress(event);
      return event;
    })
  );

  return enriched;
}
