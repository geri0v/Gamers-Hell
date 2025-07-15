import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import {
  enrichItemsAndPrices,
  resolveWaypoints,
  fetchWikiDescription
} from 'https://geri0v.github.io/Gamers-Hell/js/info.js';

export async function loadAndEnrichData(onProgress = null) {
  const rawEvents = await fetchAllData();
  const uniqueItemIds = new Set();
  rawEvents.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => { if (item.id) uniqueItemIds.add(item.id); });
    }
  });
  const itemIds = Array.from(uniqueItemIds);

  const enrichedItems = await enrichItemsAndPrices(itemIds);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  const chatcodes = [];
  rawEvents.forEach(e => {
    const code = e.chatcode || e.code;
    if (code && code.length > 5) chatcodes.push(code.trim());
  });
  const waypointMap = await resolveWaypoints(chatcodes);

  const enrichedEvents = await Promise.all(rawEvents.map(async event => {
    const codeRaw = event.chatcode || event.code || "";
    const wp = waypointMap[codeRaw] || null;
    event.waypointName = wp ? wp.name : null;
    event.waypointWikiLink = wp ? wp.wiki : null;
    event.code = codeRaw;
    event.wikiLink = event.name ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, "_"))}` : null;
    event.mapWikiLink = event.map ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, "_"))}` : null;
    event.description = await fetchWikiDescription(event.waypointName || event.name || '');
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
    if (onProgress) onProgress(event);
    return event;
  }));
  return enrichedEvents;
}
