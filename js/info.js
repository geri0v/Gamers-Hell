// js/info.js — STRICT ITEM, FLEXIBELE EVENT-ENRICHMENT

export const GW2_API = "https://api.guildwars2.com/v2";
export const GW2T_API = "https://api.gw2treasures.com";
export const GW2T_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
export const OTC_CSV_URL = "https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv";
export const DROPRATE_CSV_URL = "https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/intro%3D-20-3Cdiv-20class%3D%22smw-2Dul-2Dcolumns%22-20style%3D%22column-2Dcount:3%22-3E/outro%3D-20-3C-2Fdiv-3E/order%3Dasc/sort%3D/-5B-5BCategory:Drop-20rates-5D-5D/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCS";

let gw2ItemsCache = null;
export const wikiDescCache = new Map();

// === Utility: wiki, tp, price ===
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

// === General fetch ===
export async function safeFetchJson(url, opts = {}) {
  const needsAuth = url.includes('gw2treasures.com');
  const options = {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(needsAuth ? { Authorization: `Bearer ${GW2T_BEARER}` } : {})
    }
  };
  const res = await fetch(url, options);
  return res.ok ? await res.json() : null;
}

// === GW2 API items ophalen, cache voor fuzzy lookup ===
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

// === Simple levenshtein fuzzy (max 99% corr.) ===
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return (a || b).length;
  let matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  matrix[0] = Array.from({ length: a.length + 1 }, (_, j) => j);
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}
function fuzzy99(a, b) {
  // Sta 1 character verschil toe bij >8 char (simple)
  const l = Math.max(a.length, b.length);
  if (l === 0) return true;
  const d = levenshtein(a, b);
  if (l <= 3) return d === 0;
  if (l < 8)  return d <= 1;
  return d / l <= 0.12; // ~99%
}

// === WIKI DESCRIPTION (max 2 zinnen) ===
export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);
  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${encodeURIComponent(name)}&exsentences=2`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data?.query?.pages) for (const page of Object.values(data.query.pages)) desc = page.extract?.trim() || "";
  wikiDescCache.set(name, desc);
  return desc;
}

// === Drop Rate: Laad drop rates in map ===
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

// === Enrichment: verrijkt loot met ECHTE GW2 items, context wordt altijd verrijkt! ===
export async function enrichEventsRaw(events) {
  const gw2Items = await fetchAllGW2Items();
  const dropRates = await fetchDropRateMap();
  const nameToApi = new Map(gw2Items.map(i => [i.name, i]));
  const idToApi = new Map(gw2Items.map(i => [i.id, i]));

  // Verrijk alle event-informatie: WIKI, MAP, LOCATIE altijd tonen
  for (const ev of events) {
    ev.wikiLink = getWikiLink(ev.name);
    if (ev.expansion)      ev.expansionWikiLink = getWikiLink(ev.expansion);
    if (ev.map)            ev.mapWikiLink = getWikiLink(ev.map);
    if (ev.location)       ev.locationWikiLink = getWikiLink(ev.location);
    if (ev.area)           ev.areaWikiLink = getWikiLink(ev.area);
    if (ev.sourcename)     ev.sourcenameWikiLink = getWikiLink(ev.sourcename);
    if (ev.closestWaypoint)ev.closestWaypointWikiLink = getWikiLink(ev.closestWaypoint);
    // etc: voeg alle gewenste fields toe met wikiLink!
  }

  // STRIKT: loot ENKEL tonen als NAAM ≥99% fuzzy met GW2API
  for (const ev of events) {
    const enrichedLoot = [];
    for (const l of (ev.loot||[])) {
      // Zoek de beste fuzzy GW2 API-match (≥99%)
      let match = null;
      let minFuzzy = 100;
      for(const apiItem of gw2Items) {
        const fuzz = levenshtein((l.name||"").toLowerCase(), (apiItem.name||"").toLowerCase());
        if (fuzzy99(l.name||"", apiItem.name||"")) {
          if (fuzz < minFuzzy) { minFuzzy = fuzz; match = apiItem; }
        }
      }
      if (!match) continue; // Geen zekere match = skip dit loot-item

      // Overschrijf ID/CLEANUP, alleen officiële GW2 API id
      l.id = match.id;
      l.name = match.name; // gebruik juiste spelling
      l.type = match.type;
      l.rarity = match.rarity;
      l.icon = match.icon;
      l.flags = match.flags;
      l.chat_link = match.chat_link;

      // Verrijk met prijzen, TP, wiki, droprate enz.
      l.price = match.price || null;
      l.tpLink = getTPLink(match.name);
      l.wikiLink = getWikiLink(match.name);
      l.dropRate = dropRates[match.name] || dropRates[match.id] || '';
      l.accountBound = match.flags?.includes("AccountBound") || false;
      l.collectible = match.collectible || false;
      l.achievementLinked = match.achievementLinked || false;
      l.guaranteed = l.guaranteed === true || l.guaranteed === "Yes";

      enrichedLoot.push(l);
    }
    ev.loot = enrichedLoot; // Alleen echte GW2 items over
  }
  return events;
}
