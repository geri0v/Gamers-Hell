// infoload.js — Full enrichment loader for Gamers-Hell using info.js as backend

import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import {
  enrichItemsAndPrices,
  resolveWaypoints,
  fetchWikiDescription
} from 'https://geri0v.github.io/Gamers-Hell/js/info.js';

/**
 * Loads, flattens, enriches, and returns all event records used across the visualizer.
 * @param {Function} onProgress - Optional callback after each record is enriched
 * @returns {Promise<Array>} Fully enriched event list
 */
export async function loadAndEnrichData(onProgress = null) {
  // 1. Load raw events from manifest-listed JSON files
  const rawEvents = await fetchAllData();

  // 2. Extract unique item IDs for enrichment
  const uniqueItemIds = new Set();
  rawEvents.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => {
        if (item.id) uniqueItemIds.add(item.id);
      });
    }
  });

  const itemIds = Array.from(uniqueItemIds);

  // 3. Enrich loot items with full item data, prices, vendor value, etc.
  const enrichedItems = await enrichItemsAndPrices(itemIds);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  // 4. Resolve waypoint codes (chat_links → readable names)
  const chatcodes = [];
  rawEvents.forEach(e => {
    const code = e.chatcode || e.code;
    if (code && code.length > 5) chatcodes.push(code.trim());
  });

  const waypointMap = await resolveWaypoints(chatcodes);

  // 5. Final pass: construct the enriched event objects
  const enrichedEvents = await Promise.all(
    rawEvents.map(async event => {
      // Event waypoint resolution
      const codeRaw = event.chatcode || event.code || "";
      const wp = waypointMap[codeRaw] || null;
      event.waypointName = wp ? wp.name : null;
      event.waypointWikiLink = wp ? wp.wiki : null;
      event.code = codeRaw;

      // Add Event + Map wikiLinks
      event.wikiLink = event.name
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, "_"))}`
        : null;
      event.mapWikiLink = event.map
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, "_"))}`
        : null;

      // Add inline description from Wiki (optional)
      event.description = await fetchWikiDescription(event.waypointName || event.name || '');

      // Loot enrichment
      if (Array.isArray(event.loot)) {
        event.loot = event.loot.map(item => {
          const enriched = item.id ? itemMap.get(item.id) : null;
          return {
            ...item,
            icon: enriched?.icon || null,
            wikiLink: enriched?.name
              ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(enriched.name.replace(/ /g, "_"))}`
              : item.name
              ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name.replace(/ /g, "_"))}`
              : null,
            accountBound: enriched?.flags?.includes("AccountBound") || false,
            chatCode: enriched?.chat_link || null,
            price: enriched?.price ?? null,
            vendorValue: enriched?.vendor_value ?? null,
            type: enriched?.type ?? null,
            guaranteed: !!item.guaranteed
          };
        });
      }

      // Optional real-time callback: show progress or loading
      if (onProgress) onProgress(event);

      return event;
    })
  );

  return enrichedEvents;
}
