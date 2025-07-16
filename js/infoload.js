// infoload.js — Event enrichment orchestrator

import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import {
  enrichItemsAndPrices,
  resolveWaypoints,
  fetchWikiDescription
} from 'https://geri0v.github.io/Gamers-Hell/js/info.js';

/**
 * Load and enrich all event data (description, icons, prices, waypoints, links, flags)
 * @param {Function} onProgress (optional callback to update UI progress)
 * @returns {Promise<Array>} Enriched list of event objects ready for rendering
 */
export async function loadAndEnrichData(onProgress = null) {
  const rawEvents = await fetchAllData();
  const uniqueItemIds = new Set();

  rawEvents.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => {
        if (item.id) uniqueItemIds.add(item.id);
      });
    }
  });

  const itemIds = Array.from(uniqueItemIds);
  const enrichedItems = await enrichItemsAndPrices(itemIds);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  // Resolve waypoint chatcodes → names
  const chatcodes = rawEvents
    .map(e => e.chatcode || e.code || '')
    .filter(c => c.length > 5);
  const waypointMap = await resolveWaypoints(chatcodes);

  // Assemble enriched event objects
  const enrichedEvents = await Promise.all(
    rawEvents.map(async event => {
      const codeRaw = event.chatcode || event.code || '';
      const wpMeta = waypointMap[codeRaw] || null;

      event.waypointName = wpMeta?.name || null;
      event.waypointWikiLink = wpMeta?.wiki || null;
      event.code = codeRaw;

      event.wikiLink = event.name
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, '_'))}`
        : null;

      event.mapWikiLink = event.map
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, '_'))}`
        : null;

      // Wiki short description
      event.description = await fetchWikiDescription(event.waypointName || event.name || '');

      // Enrich loot array per item with full details
      if (Array.isArray(event.loot)) {
        event.loot = event.loot.map(l => {
          const enriched = l.id && itemMap.get(l.id);
          const wikiLink = enriched?.name || l.name
            ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent((enriched?.name || l.name).replace(/ /g, '_'))}`
            : null;

          return {
            ...l,
            icon: enriched?.icon || null,
            wikiLink,
            accountBound: enriched?.flags?.includes("AccountBound") || false,
            chatCode: enriched?.chat_link || null,
            vendorValue: enriched?.vendor_value ?? null,
            price: enriched?.price ?? null,
            type: enriched?.type ?? null,
            rarity: enriched?.rarity || l.rarity || null,
            guaranteed: !!l.guaranteed
          };
        });
      }

      if (onProgress) onProgress(event);
      return event;
    })
  );

  return enrichedEvents;
}
