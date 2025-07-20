// info.js — FULL MASTER ENRICHED DROP
// Voor gebruik in je loader/enrichment-pipeline. Alles is dynamisch/live.

const GW2_API = "https://api.guildwars2.com/v2";
const GW2T_API = "https://api.gw2treasures.com";
const GW2T_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const OTC_CSV_URL = "https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv";
const DROPRATE_CSV_URL = "https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/intro%3D-20-3Cdiv-20class%3D%22smw-2Dul-2Dcolumns%22-20style%3D%22column-2Dcount:3%22-3E/outro%3D-20-3C-2Fdiv-3E/order%3Dasc/sort%3D/-5B-5BCategory:Drop-20rates-5D-5D/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCS";

let otcRowsCache = null, gw2ItemsCache = null, droprateMap = null;
const wikiDescCache = new Map();

function getWikiLink(label) {
  if (!label) return null;
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(label.replace(/ /g, '_'))}`;
}

function getTPLink(name) {
  if (!name) return null;
  return `https://gw2trader.gg/search?q=${encodeURIComponent(name)}`;
}

function formatPrice(copper) {
  if (copper == null) return '';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}

async function safeFetchJson(url, opts = {}) {
  const needsAuth = url.includes('gw2treasures.com');
  const options = {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(needsAuth ? { Authorization: `Bearer ${GW2T_BEARER}` } : {})
    }
  };
  try {
    const res = await fetch(url, options);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ===== OTC LOADEN EN MAP BOUWEN =====
export async function fetchOtcRows() {
  if (otcRowsCache) return otcRowsCache;
  const text = await (await fetch(OTC_CSV_URL)).text();
  const rows = await new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true, skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
  otcRowsCache = rows;
  return rows;
}

// ===== DROP RATE LOADEN EN MAP BOUWEN =====
async function fetchDropRateMap() {
  if (droprateMap) return droprateMap;
  // Download CSV, maak map van ItemName of ItemID → DropRate/Source
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
    if (row.Item) {
      droprateMap[row.Item] = row['Drop rate'] || row.DropRate || row['Drop Rate'] || "";
    }
    if (row.ItemID) {
      droprateMap[row.ItemID] = row['Drop rate'] || row.DropRate || row['Drop Rate'] || "";
    }
  });
  return droprateMap;
}

// ===== VOLLEDIGE GW2 ITEM LIST (NAAMMATCH/FUZZY) =====
async function fetchAllGW2Items() {
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

// ====== WIKI DESCRIPTION (MAX 2 ZINNEN) =======
export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);
  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${encodeURIComponent(name)}&exsentences=2`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data?.query?.pages) {
    for (const page of Object.values(data.query.pages)) {
      desc = page.extract?.trim() || "";
    }
  }
  wikiDescCache.set(name, desc);
  return desc;
}

// ===== BELANGRIJKSTE ENRICHMENT PIPELINE (MAIN EXPORT) =====
export async function fullEnrichDrop(events) {
  // 0. FASE 0: LAAD OTC, GW2-items, Drop rate data:
  const [otcRows, gw2Items, droprate] = await Promise.all([
    fetchOtcRows(), fetchAllGW2Items(), fetchDropRateMap()
  ]);
  const nameToOtc = new Map(otcRows.map(r => [r.Name, r]));
  const nameToGw2 = new Map(gw2Items.map(i => [i.name, i]));
  const idToGw2 = new Map(gw2Items.map(i => [i.id, i]));

  // FASE 1: NAAM-ID MATCHING & ENRICH (GW2 API, GW2Treasures, OTC beslisboom)
  for (const ev of events) {
    // Expansion validate/correct (basic: bijv. via mapping)
    if (!ev.expansion || ev.expansion === "" || ev.expansion === "Unknown") {
      // Hier kun je een MapName->Expansion mapping gebruiken
      // Bijvoorbeeld: if (mapExpansionMap[ev.map]) ev.expansion = mapExpansionMap[ev.map];
    }
    ev.mapWikiLink = getWikiLink(ev.map);
    ev.wikiLink = getWikiLink(ev.name);
    // Haal evt. waypoint/locatie op via waypoint.js

    // Beschrijving:
    ev.description = await fetchWikiDescription(ev.name);

    for (const loot of (ev.loot||[])) {
      // Probeer ID te vullen als niet aanwezig:
      if (!loot.id) {
        // 1. Probeer eerst officiële GW2 items, case-insensitive fuzzy (99%+)
        let match = gw2Items.find(i => i.name && loot.name && i.name.toLowerCase() == loot.name.toLowerCase());
        if (!match) {
          // Levenshtein fuzzy (~99%) (optioneel, want traag bij veel items)
          match = gw2Items.find(i => i.name && loot.name &&
            levenshtein(i.name.toLowerCase(), loot.name.toLowerCase()) < 2);
        }
        if (match) loot.id = match.id;
        // 2. GW2Treasures fallback kan eventueel hier hard op naam (niet altijd nodig)
        // (kan met secondaire dataset)
        // 3. OTC csv fallback:
        if (!loot.id && nameToOtc.has(loot.name)) {
          loot.id = Number(nameToOtc.get(loot.name).ID);
        }
      }
      loot.wikiLink = getWikiLink(loot.name);
      loot.tpLink = getTPLink(loot.name);

      // DROP RATE lookup:
      loot.dropRate = droprate[loot.name] || droprate[loot.id] || '';

      // Expansion, Map, etc — kan evt per loot, maar meestal alleen op event (zie boven)
      // Add location, area, etc. if available

      // Collectible, AccountBound enz. — zet als boolean of uit flags
      if (!loot.accountBound && loot.flags && Array.isArray(loot.flags)) {
        loot.accountBound = loot.flags.includes('AccountBound');
      }
    }
  }

  // FASE 2: Haal info/prijzen voor ALLE loot met id! (GW2 API/GW2Treasures)
  const enrichIds = [...new Set(events.flatMap(ev => (ev.loot||[]).map(l => l.id).filter(Boolean)))];
  const [gw2ItemInfo, treasuresInfo, tpPrices] = await Promise.all([
    safeFetchJson(`${GW2_API}/items?ids=${enrichIds.join(',')}`),
    safeFetchJson(`${GW2T_API}/items?ids=${enrichIds.join(',')}`, { headers: { Authorization: `Bearer ${GW2T_BEARER}` }}),
    safeFetchJson(`${GW2_API}/commerce/prices?ids=${enrichIds.join(',')}`)
  ]);
  const idToItem = new Map((gw2ItemInfo || []).map(i => [i.id, i]));
  const idToTreasure = new Map((treasuresInfo || []).map(i => [i.id, i]));
  const idToPrice = new Map((tpPrices || []).map(p => [p.id, p.sells?.unit_price || p.unit_price || 0]));

  // FASE 3: Verrijk alle loot verder
  for (const ev of events) {
    for (const loot of (ev.loot||[])) {
      if (!loot.id) continue; // kan nu niet optimaal enrichen
      const gItem = idToItem.get(loot.id) || {};
      const tItem = idToTreasure.get(loot.id) || {};
      loot.icon = tItem.icon || gItem.icon || null;
      loot.type = tItem.type || gItem.type || null;
      loot.chat_link = tItem.chat_link || gItem.chat_link || null;
      loot.price = idToPrice.get(loot.id) || tItem.price || null;
      loot.vendorValue = gItem.vendor_value ?? tItem.vendor_value ?? null;
      loot.accountBound = gItem.flags?.includes("AccountBound") || tItem.flags?.includes("AccountBound") || loot.accountBound || false;
      loot.collectible = gItem.collectible || loot.collectible || false;
      loot.achievementLinked = gItem.achievementLinked || loot.achievementLinked || false;
      // Je kunt hier alles aanvullen wat uit API/GW2T extra komt
    }
    // Filter alleen waardevolle loot:
    ev.loot = (ev.loot||[]).filter(isValuableLoot);
  }

  // RETURN — alles enriched, full hierarchy
  return events;
}

// ====== FILTER GENERIC LOOT TYPE (MAG JE NOG VERBREDEN) =====
function isValuableLoot(item) {
  if (!item || !item.rarity) return false;
  const r = item.rarity.toLowerCase();
  if (['exotic','ascended','legendary','rare','unique'].includes(r)) return true;
  if (item.collectible || item.achievementLinked) return true;
  if (item.price && Number(item.price) > 20000) return true; // >2g
  if (/skin|mini|collection|infusion|back/i.test(item.name || "")) return true;
  // weg met basic/common/junk/bags/chests
  const FILTER_GENERIC = [
    /common/i, /fine/i, /basic/i, /green/i,
    /junk/i, /container/i, /bag/i, /chest/i, /cache/i, /box/i, /crate/i, /sack/i,
    /^trophy$/i
  ];
  return !FILTER_GENERIC.some(rx => rx.test(item.rarity)) &&
         !FILTER_GENERIC.some(rx => rx.test(item.name));
}



// ======= (OPTIONEEL) SIMPLE LEVENSHTEIN VOOR FUZZY MATCH (kleine diff toelaten) =======
function levenshtein(a, b) {
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
