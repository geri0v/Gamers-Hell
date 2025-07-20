// js/info.js — FAST PRODUCTION ENRICHMENT GUILD WARS 2

export const GW2_API = "https://api.guildwars2.com/v2";

export function getWikiLink(label) {
  if (!label) return null;
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(label.replace(/ /g, '_'))}`;
}
export function getTPLink(name) {
  if (!name) return null;
  return `https://gw2trader.gg/search?q=${encodeURIComponent(name)}`;
}
export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}
export async function safeFetchJson(url) {
  const res = await fetch(url);
  return res.ok ? await res.json() : null;
}

// Levenshtein & fuzzy99
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return (a || b).length;
  const v0 = Array(b.length + 1).fill(0).map((_, i) => i);
  let v1 = new Array(b.length + 1);
  for (let i = 0; i < a.length; ++i) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; ++j) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; ++j) v0[j] = v1[j];
  }
  return v1[b.length];
}
function fuzzy99(a, b) {
  a = (a || '').toLowerCase();
  b = (b || '').toLowerCase();
  const l = Math.max(a.length, b.length);
  if (l === 0) return true;
  const d = levenshtein(a, b);
  if (l <= 3) return d === 0;
  if (l < 8)  return d <= 1;
  return d / l <= 0.12;
}

// ------- GW2 items ophalen: slechts 1x per paginaververs -------
let gw2ItemsCache = null;
/**
 * Haalt ALLE GW2 items op, 1 keer per sessie
 */
export async function fetchAllGW2Items(forceReload = false) {
  if (gw2ItemsCache && !forceReload) return gw2ItemsCache;
  const ids = await safeFetchJson(`${GW2_API}/items`);
  if (!ids) throw new Error("API call failed: items-ids");
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = await safeFetchJson(`${GW2_API}/items?ids=${ids.slice(i, i + 200).join(',')}`);
    if (batch) out.push(...batch);
  }
  gw2ItemsCache = out;
  return out;
}

/**
 * FAST ENRICHMENT:
 *  - Loot: alleen als GW2-item (exact/fuzzy99), with GW2-id, type, icon, etc
 *  - Events: altijd verrijkt met wiki, expansion, map, area, ... (ongeacht loot)
 *  - Geen CORS, geen externe droprate
 */
export async function fastEnrichEvents(events) {
  const gw2Items = await fetchAllGW2Items();

  // Verzamel alle unieke lootnamen
  const lootNames = [...new Set(events.flatMap(ev => (ev.loot || []).map(l => l.name)).filter(Boolean))];

  // Map lootnaam naar GW2 API item
  const nameToApiItem = new Map();
  for (const name of lootNames) {
    let match = gw2Items.find(apiItem => apiItem.name && apiItem.name === name);
    if (!match) {
      const candidates = gw2Items.filter(apiItem =>
        apiItem.name && apiItem.name[0].toLowerCase() === name[0].toLowerCase()
      );
      let minFuzz = 100, best = null;
      for (const apiItem of candidates) {
        const fuzz = levenshtein(name.toLowerCase(), apiItem.name.toLowerCase());
        if (fuzzy99(name, apiItem.name) && fuzz < minFuzz) {
          best = apiItem; minFuzz = fuzz;
        }
      }
      if (best) match = best;
    }
    if (match) nameToApiItem.set(name, match);
  }

  // Verrijk alles (event-info altijd, loot alleen op echte GW2 items)
  for (const ev of events) {
    ev.wikiLink = getWikiLink(ev.name);
    if (ev.expansion)        ev.expansionWikiLink = getWikiLink(ev.expansion);
    if (ev.map)              ev.mapWikiLink = getWikiLink(ev.map);
    if (ev.location)         ev.locationWikiLink = getWikiLink(ev.location);
    if (ev.area)             ev.areaWikiLink = getWikiLink(ev.area);
    if (ev.sourcename)       ev.sourcenameWikiLink = getWikiLink(ev.sourcename);
    if (ev.closestWaypoint)  ev.closestWaypointWikiLink = getWikiLink(ev.closestWaypoint);

    ev.loot = (ev.loot || []).map(l => {
      const apiItem = nameToApiItem.get(l.name);
      if (!apiItem) return null; // Niet officieel item
      return {
        ...l,
        id: apiItem.id,
        name: apiItem.name,
        type: apiItem.type,
        rarity: apiItem.rarity,
        icon: apiItem.icon,
        vendorValue: apiItem.vendor_value ?? null,
        wikiLink: getWikiLink(apiItem.name),
        tpLink: getTPLink(apiItem.name),
        price: apiItem.price || null,
        accountBound: apiItem.flags?.includes("AccountBound") || false,
        collectible: apiItem.collectible || false,
        achievementLinked: apiItem.achievementLinked || false,
        guaranteed: l.guaranteed === true || l.guaranteed === "Yes"
        // ...je kunt alles toevoegen wat uit apiItem of loot komt
      }
    }).filter(Boolean);
  }
  return events;
}
