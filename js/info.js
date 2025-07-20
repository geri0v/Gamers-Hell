// js/info.js — STRICT [UNIEKE NAAM], FLEXIBLE EVENT-ENRICHMENT

export const GW2_API = "https://api.guildwars2.com/v2";
export const DROPRATE_CSV_URL =
  "https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/intro%3D-20-3Cdiv-20class%3D%22smw-2Dul-2Dcolumns%22-20style%3D%22column-2Dcount:3%22-3E/outro%3D-20-3C-2Fdiv-3E/order%3Dasc/sort%3D/-5B-5BCategory:Drop-20rates-5D-5D/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCS";

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

// Efficient levenshtein + fuzzy99
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return (a || b).length;
  let prev = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 0; i < a.length; ++i) {
    let curr = [i + 1];
    for (let j = 0; j < b.length; ++j)
      curr.push(Math.min(
        prev[j + 1] + 1,
        curr[j] + 1,
        prev[j] + (a[i] === b[j] ? 0 : 1)
      ));
    prev = curr;
  }
  return prev[b.length];
}
function fuzzy99(a, b) {
  a = (a || '').toLowerCase();
  b = (b || '').toLowerCase();
  const l = Math.max(a.length, b.length);
  if (l === 0) return true;
  const d = levenshtein(a, b);
  if (l <= 3) return d === 0;
  if (l < 8)  return d <= 1;
  return d / l <= 0.12; // ~99%
}

// GW2 items bulk ophalen
let gw2ItemsCache = null;
export async function fetchAllGW2Items() {
  if (gw2ItemsCache) return gw2ItemsCache;
  const allIds = await safeFetchJson(`${GW2_API}/items`);
  const out = [];
  for (let i = 0; i < allIds.length; i += 200) {
    const batch = await safeFetchJson(`${GW2_API}/items?ids=${allIds.slice(i, i+200).join(',')}`);
    if (batch) out.push(...batch);
  }
  gw2ItemsCache = out;
  return out;
}

// Drop Rate
let droprateMap = null;
export async function fetchDropRateMap() {
  if (droprateMap) return droprateMap;
  const text = await (await fetch(DROPRATE_CSV_URL)).text();
  const rows = await new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true, skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
  droprateMap = {};
  rows.forEach(row => {
    if (row.Item) droprateMap[row.Item] = row['Drop rate'] || row.DropRate || row['Drop Rate'] || "";
    if (row.ItemID) droprateMap[row.ItemID] = row['Drop rate'] || row.DropRate || row['Drop Rate'] || "";
  });
  return droprateMap;
}

/**
 * SNELLE, STRIKTE GW2-ENRICHMENT-PIPELINE
 * - Loot: één match/naam (99% fuzzy), alleen tonen als GW2 item bestaat
 * - Event/meta: altijd tonen, altijd wiki-link
 */
export async function fastEnrichEvents(events) {
  const gw2Items = await fetchAllGW2Items();
  const dropRates = await fetchDropRateMap();

  // 1. Verzamel ALLE UNIEKE lootnamen
  const allLootNames = [...new Set(events.flatMap(ev => (ev.loot||[]).map(l => l.name)).filter(Boolean))];

  // 2. Voor elke lootnaam, exact match > first-letter > fuzzy99 (maar nooit vaker dan één keer)
  const nameToApiItem = new Map();
  for (const name of allLootNames) {
    let best = gw2Items.find(apiItem => apiItem.name === name);
    // Als geen exact, zoek met zelfde eerste letter, dan fuzzy (minst afstand, >99%)
    if (!best) {
      const candidates = gw2Items.filter(apiItem =>
        apiItem.name && apiItem.name[0].toLowerCase() === name[0].toLowerCase());
      let minFuzzy = 100;
      for (const apiItem of candidates) {
        const fuzz = levenshtein(name.toLowerCase(), apiItem.name.toLowerCase());
        if (fuzzy99(name, apiItem.name) && fuzz < minFuzzy) {
          best = apiItem;
          minFuzzy = fuzz;
        }
      }
    }
    if (best) nameToApiItem.set(name, best);
  }

  // 3. Verrijk events: context telt altijd, loot alleen als officiele GW2-item gevonden!
  for (const ev of events) {
    ev.wikiLink = getWikiLink(ev.name);
    if (ev.expansion) ev.expansionWikiLink = getWikiLink(ev.expansion);
    if (ev.map) ev.mapWikiLink = getWikiLink(ev.map);
    if (ev.location) ev.locationWikiLink = getWikiLink(ev.location);
    if (ev.area) ev.areaWikiLink = getWikiLink(ev.area);
    if (ev.sourcename) ev.sourcenameWikiLink = getWikiLink(ev.sourcename);
    if (ev.closestWaypoint) ev.closestWaypointWikiLink = getWikiLink(ev.closestWaypoint);

    // Verrijk alle loot-items per event
    ev.loot = (ev.loot || []).map(l => {
      const apiItem = nameToApiItem.get(l.name);
      if (!apiItem) return null;
      return {
        ...l,
        id: apiItem.id,
        name: apiItem.name,
        type: apiItem.type,
        rarity: apiItem.rarity,
        icon: apiItem.icon,
        price: apiItem.price || null,
        wikiLink: getWikiLink(apiItem.name),
        tpLink: getTPLink(apiItem.name),
        dropRate: dropRates[apiItem.name] || dropRates[apiItem.id] || '',
        accountBound: apiItem.flags?.includes("AccountBound") || false,
        collectible: apiItem.collectible || false,
        achievementLinked: apiItem.achievementLinked || false,
        guaranteed: l.guaranteed === true || l.guaranteed === "Yes"
      }
    }).filter(Boolean);
  }
  return events;
}
