// infoload.js — Event enrichment orchestrator

import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import {
  enrichItemsAndPrices,
  resolveWaypoints,
  fetchWikiDescription
} from 'https://geri0v.github.io/Gamers-Hell/js/info.js';

/**
 * Load and enrich all event data
 * @param {Function} onProgress (optional callback)
 * @returns {Promise<Array>} Enriched event objects
 */
export async function loadAndEnrichData(onProgress = null) {
  const rawEvents = await fetchAllData();

  // Collect unique item IDs
  const uniqueItemIds = new Set();
  rawEvents.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => {
        if (item.id) uniqueItemIds.add(item.id);
      });
    }
  });

  // Fetch and map enriched items
  const itemIds = Array.from(uniqueItemIds);
  const enrichedItems = await enrichItemsAndPrices(itemIds);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  // Resolve all waypoint chatcodes (trim trimmed)
  const chatcodes = rawEvents
    .map(e => (e.chatcode || e.code || '').trim())
    .filter(c => c.length > 5);
  const waypointMap = await resolveWaypoints(chatcodes);

  // Enrich each event
  const enrichedEvents = await Promise.all(
    rawEvents.map(async event => {
      const codeRaw = (event.chatcode || event.code || '').trim();
      const wpMeta = waypointMap[codeRaw] || {};

      event.waypointName = wpMeta.name || null;
      event.waypointWikiLink = wpMeta.wiki || null;
      event.code = codeRaw;

      event.wikiLink = event.name
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, '_'))}`
        : null;

      event.mapWikiLink = event.map
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, '_'))}`
        : null;

      // 📘 Fetch short description (prefer event.name over waypointName)
      event.description = await fetchWikiDescription(event.name || event.waypointName || '');

      // 🔁 Enrich loot array
      if (Array.isArray(event.loot)) {
        event.loot = event.loot.map(l => {
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
      }

      if (onProgress) {
        onProgress(event);
        console.log(`[Enriched] ${event.name}`);
      }

      return event;
    })
  );

  return enrichedEvents;
}
