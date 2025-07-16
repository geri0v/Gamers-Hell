import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichItemsAndPrices, fetchWikiDescription } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import { resolveWaypoints } from 'https://geri0v.github.io/Gamers-Hell/js/waypoint.js';

export async function loadAndEnrichData(onProgress = null) {
  const rawEvents = await fetchAllData();

  const uniqueItemIds = new Set();
  rawEvents.forEach(event => {
    (event?.loot || []).forEach(item => item.id && uniqueItemIds.add(item.id));
  });

  const enrichedItems = await enrichItemsAndPrices([...uniqueItemIds]);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  const chatcodes = rawEvents
    .map(e => (e.chatcode || e.code || '').trim())
    .filter(code => code.length > 5);

  const waypointMap = await resolveWaypoints(chatcodes);

  const enriched = await Promise.all(
    rawEvents.map(async event => {
      const code = (event.chatcode || event.code || '').trim();
      const wp = waypointMap[code] || {};

      event.waypointName = wp.name || null;
      event.waypointWikiLink = wp.wiki || null;
      event.code = code;

      event.wikiLink = event.name
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, '_'))}`
        : null;

      event.mapWikiLink = event.map
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, '_'))}`
        : null;

      event.description = await fetchWikiDescription(event.name || wp.name || '');

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
