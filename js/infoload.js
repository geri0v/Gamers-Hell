import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichItemsAndPrices, fetchWikiDescription } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import { resolveWaypoints } from 'https://geri0v.github.io/Gamers-Hell/js/waypoint.js';

/**
 * Load and enrich all event data
 * @param {Function|null} onProgress — Optional per-item callback
 * @returns {Promise<Array>} Enriched event array
 */
export async function loadAndEnrichData(onProgress = null) {
  try {
    const rawEvents = await fetchAllData();

    if (!rawEvents?.length) {
      console.warn("⚠️ No raw events loaded from manifest.");
    }

    // Step 1: Collect unique item IDs from loot
    const uniqueItemIds = new Set();
    rawEvents.forEach(event => {
      (event?.loot || []).forEach(item => item.id && uniqueItemIds.add(item.id));
    });

    const itemIds = [...uniqueItemIds];
    const enrichedItems = await enrichItemsAndPrices(itemIds);
    const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

    // Step 2: Collect chatcodes for waypoint resolution
    const chatcodes = rawEvents
      .map(e => (e.chatcode || e.code || '').trim())
      .filter(code => code.length > 5);

    const waypointMap = await resolveWaypoints(chatcodes);

    // Step 3: Enrich each event
    const enriched = await Promise.all(
      rawEvents.map(async event => {
        const code = (event.chatcode || event.code || '').trim();
        const wp = waypointMap[code] || {};

        // Waypoint
        event.code = code;
        event.waypointName = wp.name || null;
        event.waypointWikiLink = wp.wiki || null;

        // Event Wiki
        event.wikiLink = event.name
          ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, "_"))}`
          : null;

        // Map Wiki
        event.mapWikiLink = event.map
          ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, "_"))}`
          : null;

        // Get description (only first 2 full sentences)
        const descRaw = await fetchWikiDescription(event.name || wp.name || '');
        const match = descRaw?.match(/^(.+?[.!?])\s*(.+?[.!?])/);
        event.description = match ? `${match[1]} ${match[2]}` : descRaw;

        // Enrich loot
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

        // Progress callback (e.g., for logging/debug)
        if (onProgress) onProgress(event);
        return event;
      })
    );

    console.log(`✅ Enriched ${enriched.length} events`);
    return enriched;
  } catch (err) {
    console.error("🔥 Error enriching event data:", err);
    return [];
  }
}
