// js/infoload.js
import { fetchAllData } from './data.js';
import { enrichItemsAndPrices, fetchWikiDescription } from './info.js';
import { resolveWaypoints } from './waypoint.js';

/**
 * Verrijkt ALLE events. Elke loot, elke waypoint, ongeacht bron.
 */
export async function loadAndEnrichData(onProgress = null) {
  try {
    const rawEvents = await fetchAllData(onProgress);
    if (!rawEvents?.length) throw new Error("Geen events gevonden!");

    // 1: Verrijk loot-items met live info/prijzen/icons:
    const uniqueItemIds = new Set();
    rawEvents.forEach(event => (event.loot||[]).forEach(item => item.id && uniqueItemIds.add(item.id)));
    const itemIds = [...uniqueItemIds];
    const enrichedItems = await enrichItemsAndPrices(itemIds);
    const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

    // 2: Chatcode → Waypoint
    const chatcodes = rawEvents.map(e => e.chatcode || e.code || '').filter(x=>x && x.trim().length > 5);
    const waypointMap = await resolveWaypoints(chatcodes);

    // 3: Per event alles enrichen:
    const enrichedEvents = await Promise.all(
      rawEvents.map(async event => {
        const code = (event.chatcode || event.code || '').trim();
        const wp = waypointMap[code] || {};

        // Verrijk main
        event.code = code;
        event.waypointName = wp.name || null;
        event.waypointWikiLink = wp.wiki || null;
        event.wikiLink = event.name
          ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, "_"))}`
          : null;
        event.mapWikiLink = event.map
          ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, "_"))}`
          : null;

        // Verrijk beschrijving optioneel (langzaam):
        // const descRaw = await fetchWikiDescription(event.name || wp.name || '');
        // event.description = descRaw;

        // Loot verrijken
        event.loot = (event.loot || []).map(l => {
          const enriched = l.id ? itemMap.get(l.id) || {} : {};
          const name = enriched.name || l.name;
          const wikiLink = name ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` : null;
          return {
            ...l,
            name,
            icon: enriched.icon || null,
            wikiLink,
            accountBound: enriched.flags?.includes("AccountBound") || false,
            chatcode: enriched.chat_link || null,
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
    return enrichedEvents;
  } catch (err) {
    console.error('[ENRICH] Verrijken events faalde:', err);
    throw err;
  }
}
