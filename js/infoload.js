// js/infoload.js
import { formatPrice } from './info.js';
// ...gewoon te gebruiken als formatPrice(x)

import { fetchAllData } from './data.js';
import {
  fetchOtcRows,
  enrichItemsAndPrices,
  fetchWikiDescription,
  getWikiLink,
  formatPrice
} from './info.js';
import { resolveWaypoints } from './waypoint.js';

// Optioneel: voor fuzzy levenshtein (gebruik uit info.js of plak los)
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return (a || b).length;
  let matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  matrix[0] = Array.from({ length: a.length + 1 }, (_, j) => j);
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Vol-ledige enrichment & filtering pipeline!
 */
export async function loadAndEnrichData(onProgress = null) {
  // 1. Laad events/loot uit sheet & manifest
  const rawEvents = await fetchAllData(onProgress);
  if (!rawEvents?.length) throw new Error("Geen events gevonden!");

  // 2. OTC rows cachen voor loot zonder ID
  const otcRows = await fetchOtcRows();
  const nameToOtc = new Map(otcRows.map(r => [r.Name, r]));

  // 3. Fuzzy naam→id & enrichment stap per loot zonder id (GW2/GW2Treasures hieruit)
  // (optioneel: batch voor grote datasets, hier direct)
  // Je kunt ook een fuzzy batch-lookup doen als je dat wilt. Hier alleen OTC als fallback.
  for (const event of rawEvents) {
    for (const loot of (event.loot || [])) {
      if (!loot.id && loot.name && nameToOtc.has(loot.name)) {
        loot.id = Number(nameToOtc.get(loot.name).ID);
        loot.type = loot.type || nameToOtc.get(loot.name).Type;
        loot.chat_link = loot.chat_link || nameToOtc.get(loot.name).chat_link;
        loot.vendorValue = loot.vendorValue || Number(nameToOtc.get(loot.name).vendor_value || 0);
      }
      loot.wikiLink = getWikiLink(loot.name);
      loot.tpLink   = `https://gw2trader.gg/search?q=${encodeURIComponent(loot.name)}`;
    }
  }

  // 4. Verzamel alle unieke IDs (alleen loot met id)
  const uniqueItemIds = Array.from(new Set(rawEvents.flatMap(ev => (ev.loot || []).map(l => l.id).filter(Boolean))));
  // 5. Bulk enrichment items
  const enrichedItems = await enrichItemsAndPrices(uniqueItemIds);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  // 6. Waypoints/Chatcodes ophalen
  const chatcodes = rawEvents.map(e => e.chatcode || e.code || '').filter(x => x && x.trim().length > 5);
  const waypointMap = await resolveWaypoints(chatcodes);

  // 7. Verrijk per event & loot
  const enrichedEvents = [];
  for (const event of rawEvents) {
    const code = (event.chatcode || event.code || '').trim();
    const wp = waypointMap[code] || {};

    event.code = code || null;
    event.waypointName = wp.name || null;
    event.waypointWikiLink = wp.wiki || null;
    event.wikiLink = getWikiLink(event.name);
    event.mapWikiLink = getWikiLink(event.map);

    // Optional: beschrijving max 2 zinnen
    // event.description = await fetchWikiDescription(event.name);

    // Verrijk loot
    event.loot = (event.loot || [])
      .map(l => {
        const enriched = l.id ? (itemMap.get(l.id) || {}) : {};
        const pass = (enriched.name?.toLowerCase() === l.name?.toLowerCase()) ||
                     (levenshtein(enriched.name || "", l.name || "") <= 1);
        // STRIKTE FILTER: min. 99% match – als niet: sla loot-item (en evt hele event) over!
        if (enriched.id && (enriched.name && pass)) {
          return {
            ...l,
            name: enriched.name || l.name,
            icon: enriched.icon || l.icon || null,
            wikiLink: l.wikiLink || getWikiLink(l.name),
            tpLink: l.tpLink || `https://gw2trader.gg/search?q=${encodeURIComponent(l.name)}`,
            accountBound:
              enriched.flags?.includes("AccountBound") ||
              l.accountBound ||
              false,
            chatcode: enriched.chat_link || l.chat_link || null,
            vendorValue: enriched.vendor_value ?? l.vendorValue ?? null,
            price: enriched.price ?? null,
            type: enriched.type ?? l.type ?? null,
            rarity: enriched.rarity || l.rarity || null,
            guaranteed: l.guaranteed === true || l.guaranteed === "Yes",
            dropRate: l.dropRate || null,
            collectible: enriched.collectible ?? l.collectible ?? false,
            achievementLinked: enriched.achievementLinked ?? l.achievementLinked ?? false,
          };
        }
        // NIET MATCHEND: dus deze loot sla je over (zie flatten step)
        return null;
      })
      .filter(Boolean);

    // Alleen events tonen met waardevolle loot (minimaal 1 loot met goede id+match)
    if (event.loot && event.loot.length) {
      if (onProgress) onProgress(event);
      enrichedEvents.push(event);
    }
  }

  return enrichedEvents;
}

