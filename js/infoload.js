// js/infoload.js
import {
  fetchAllGW2Items,
  getWikiLink,
  getTPLink,
  formatPrice,
  fastEnrichEvents
} from './info.js';

import { fetchAllData } from './data.js';

// Simple levenshtein
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
function fuzzy99(a, b) {
  const l = Math.max((a||"").length, (b||"").length);
  if (l === 0) return true;
  const d = levenshtein((a||"").toLowerCase(), (b||"").toLowerCase());
  if (l <= 3) return d === 0;
  if (l < 8)  return d <= 1;
  return d / l <= 0.12; // ~99%
}

/**
 * Complete enrichment & filtering!
 * Loot 99% fuzzy match verplicht op API, event-info altijd rijk verrijkt
 */
export async function loadAndEnrichData(onProgress = null) {
  // 1. Laad events uit data.js
  const rawEvents = await fetchAllData(onProgress);
  if (!rawEvents?.length) throw new Error("Geen events gevonden!");

  // 2. Haal ALLE GW2 API items (voor fuzzy matching)
  const gw2Items = await fetchAllGW2Items();
  // Snelheid: bouw naam → apiItem map voor snellere lookup (optioneel)
  // const nameToGW2 = new Map(gw2Items.map(i => [i.name, i]));

  // 3. Enrich events en loot
  const enrichedEvents = [];
  for (const event of rawEvents) {
    // Eventinfo: ALTIJD WIKI-links/context enriching
    event.wikiLink = getWikiLink(event.name);
    if (event.expansion)      event.expansionWikiLink = getWikiLink(event.expansion);
    if (event.map)            event.mapWikiLink = getWikiLink(event.map);
    if (event.location)       event.locationWikiLink = getWikiLink(event.location);
    if (event.area)           event.areaWikiLink = getWikiLink(event.area);
    if (event.sourcename)     event.sourcenameWikiLink = getWikiLink(event.sourcename);
    if (event.closestWaypoint)event.closestWaypointWikiLink = getWikiLink(event.closestWaypoint);

    // Loot: STRIKT — alleen ECHTE GW2 items (≥99% naam match)
    const enrichedLoot = [];
    for (const l of (event.loot||[])) {
      let match = null;
      let minFuzzy = 100;
      for(const apiItem of gw2Items) {
        if (fuzzy99(l.name||"", apiItem.name||"")) {
          const fuzz = levenshtein((l.name||"").toLowerCase(), (apiItem.name||"").toLowerCase());
          if (fuzz < minFuzzy) { minFuzzy = fuzz; match = apiItem; }
        }
      }
      if (!match) continue; // Niet een echte item, skip

      // ID altijd uit API, ALLE enrichment
      const finalId = match.id;
      enrichedLoot.push({
        ...l,
        id: finalId,
        name: match.name,
        type: match.type,
        rarity: match.rarity,
        icon: match.icon,
        flags: match.flags,
        chat_link: match.chat_link,
        price: match.price || null,
        vendorValue: match.vendor_value ?? null,
        tpLink: getTPLink(match.name),
        wikiLink: getWikiLink(match.name),
        accountBound: match.flags?.includes("AccountBound") || false,
        collectible: match.collectible || false,
        achievementLinked: match.achievementLinked || false,
        guaranteed: l.guaranteed === true || l.guaranteed === "Yes"
      });
    }
    event.loot = enrichedLoot;

    // Alleen events met loot weergeven
    if (event.loot && event.loot.length) {
      if (onProgress) onProgress(event);
      enrichedEvents.push(event);
    }
  }

  return enrichedEvents;
}
