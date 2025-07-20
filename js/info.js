// js/info.js — FULL MASTER ENRICHED DROP MET ALLES

export const GW2_API = "https://api.guildwars2.com/v2";
export const GW2T_API = "https://api.gw2treasures.com";
export const GW2T_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
export const OTC_CSV_URL = "https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv";
export const DROPRATE_CSV_URL = "https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/intro%3D-20-3Cdiv-20class%3D%22smw-2Dul-2Dcolumns%22-20style%3D%22column-2Dcount:3%22-3E/outro%3D-20-3C-2Fdiv-3E/order%3Dasc/sort%3D/-5B-5BCategory:Drop-20rates-5D-5D/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCS";

let otcRowsCache = null, gw2ItemsCache = null, droprateMap = null;
export const wikiDescCache = new Map();

// === Utility: Wiki/TP/price Links ===
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

// === General Fetch utility ===
export async function safeFetchJson(url, opts = {}) {
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

// === OTC: Load item index ===
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

// === Drop Rate: Load & build map ===
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
    if (row.Item) {
      droprateMap[row.Item] = row['Drop rate'] || row.DropRate || row['Drop Rate'] || "";
    }
    if (row.ItemID) {
      droprateMap[row.ItemID] = row['Drop rate'] || row.DropRate || row['Drop Rate'] || "";
    }
  });
  return droprateMap;
}

// === GW2 API: Load & Cache items (for fuzzy/id match) ===
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

// === WIKI DESCRIPTION (Max 2 zinnen) ===
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

// === FAST ENRICHMENT van array itemIds (compact GW2/GW2Treasures/TP) ===
export async function enrichItemsAndPrices(itemIds) {
  const items = await safeFetchJson(`${GW2_API}/items?ids=${itemIds.join(',')}`) || [];
  const prices = await safeFetchJson(`${GW2_API}/commerce/prices?ids=${itemIds.join(',')}`) || [];
  const treasures = await safeFetchJson(`${GW2T_API}/items?ids=${itemIds.join(',')}`, {
    headers: { Authorization: `Bearer ${GW2T_BEARER}` }
  }) || [];
  const treasureMap = new Map(treasures.map(i => [i.id, i]));
  const priceMap = new Map(prices.map(p => [p.id, p.sells?.unit_price || p.unit_price || 0]));
  return items.map(item => {
    const t = treasureMap.get(item.id) || {};
    return {
      ...item,
      price: priceMap.get(item.id) || t.price || null,
      icon: t.icon || item.icon || null,
      type: t.type || item.type || null,
      chat_link: t.chat_link || item.chat_link || null,
      vendor_value: item.vendor_value ?? t.vendor_value ?? null,
      flags: item.flags || t.flags || [],
      collectible: item.collectible ?? t.collectible ?? false,
      achievementLinked: item.achievementLinked ?? t.achievementLinked ?? false,
      accountBound: (item.flags && item.flags.includes("AccountBound")) || (t.flags && t.flags.includes("AccountBound")) || false
    };
  });
}

// === HOOFD PIPELINE: Events/loot enrichment ===
export async function fullEnrichDrop(events) {
  // Load all resources at once
  const [otcRows, gw2Items, droprate] = await Promise.all([
    fetchOtcRows(), fetchAllGW2Items(), fetchDropRateMap()
  ]);
  const nameToOtc = new Map(otcRows.map(r => [r.Name, r]));
  const nameToGw2 = new Map(gw2Items.map(i => [i.name, i]));
  const idToGw2 = new Map(gw2Items.map(i => [i.id, i]));

  for (const ev of events) {
    if (!ev.expansion || ev.expansion === "" || ev.expansion === "Unknown") {
      // Expansion-fix, TODO: Map/auto-fix via mappingtable evt
    }
    ev.mapWikiLink = getWikiLink(ev.map);
    ev.wikiLink = getWikiLink(ev.name);
    ev.description = await fetchWikiDescription(ev.name);

    for (const loot of (ev.loot||[])) {
      // PRIMARY: fuzzy/exact match in GW2 items
      if (!loot.id) {
        let match = gw2Items.find(i => i.name && loot.name && i.name.toLowerCase() == loot.name.toLowerCase());
        if (!match) {
          match = gw2Items.find(i => i.name && loot.name &&
            levenshtein(i.name.toLowerCase(), loot.name.toLowerCase()) < 2);
        }
        if (match) loot.id = match.id;
        // OTC fallback
        if (!loot.id && nameToOtc.has(loot.name)) loot.id = Number(nameToOtc.get(loot.name).ID);
      }
      loot.wikiLink = getWikiLink(loot.name);
      loot.tpLink = getTPLink(loot.name);
      loot.dropRate = droprate[loot.name] || droprate[loot.id] || '';
      if (!loot.accountBound && loot.flags && Array.isArray(loot.flags)) {
        loot.accountBound = loot.flags.includes('AccountBound');
      }
      // Guaranteed, collectible, achievementlinked etc uit sheet/JSON overnemen indien aanwezig
      loot.guaranteed = loot.guaranteed === true || loot.guaranteed === "Yes";
      loot.collectible = loot.collectible ?? false;
      loot.achievementLinked = loot.achievementLinked ?? false;
    }
  }
  // Verrijken loot-items
  const enrichIds = [...new Set(events.flatMap(ev => (ev.loot||[]).map(l => l.id).filter(Boolean)))];
  const [gw2ItemInfo, treasuresInfo, tpPrices] = await Promise.all([
    safeFetchJson(`${GW2_API}/items?ids=${enrichIds.join(',')}`),
    safeFetchJson(`${GW2T_API}/items?ids=${enrichIds.join(',')}`, { headers: { Authorization: `Bearer ${GW2T_BEARER}` }}),
    safeFetchJson(`${GW2_API}/commerce/prices?ids=${enrichIds.join(',')}`)
  ]);
  const idToItem = new Map((gw2ItemInfo || []).map(i => [i.id, i]));
  const idToTreasure = new Map((treasuresInfo || []).map(i => [i.id, i]));
  const idToPrice = new Map((tpPrices || []).map(p => [p.id, p.sells?.unit_price || p.unit_price || 0]));

  for (const ev of events) {
    for (const loot of (ev.loot||[])) {
      if (!loot.id) continue;
      const gItem = idToItem.get(loot.id) || {};
      const tItem = idToTreasure.get(loot.id) || {};
      loot.icon = tItem.icon || gItem.icon || loot.icon || null;
      loot.type = tItem.type || gItem.type || loot.type || null;
      loot.chat_link = tItem.chat_link || gItem.chat_link || loot.chat_link || null;
      loot.price = idToPrice.get(loot.id) || tItem.price || loot.price || null;
      loot.vendorValue = gItem.vendor_value ?? tItem.vendor_value ?? loot.vendorValue ?? null;
      loot.accountBound = gItem.flags?.includes("AccountBound") || tItem.flags?.includes("AccountBound") || loot.accountBound || false;
      loot.collectible = gItem.collectible || loot.collectible || false;
      loot.achievementLinked = gItem.achievementLinked || loot.achievementLinked || false;
    }
    // FILTER: alleen waardevolle loot
    ev.loot = (ev.loot||[]).filter(isValuableLoot);
  }

  return events;
}

// === FILTER GENERIC LOOT TYPE ===
export function isValuableLoot(item) {
  if (!item || !item.rarity) return false;
  const r = item.rarity.toLowerCase();
  if (['exotic','ascended','legendary','rare','unique'].includes(r)) return true;
  if (item.collectible || item.achievementLinked) return true;
  if (item.price && Number(item.price) > 20000) return true; // >2g
  if (/skin|mini|collection|infusion|back/i.test(item.name || "")) return true;
  const FILTER_GENERIC = [
    /common/i, /fine/i, /basic/i, /green/i,
    /junk/i, /container/i, /bag/i, /chest/i, /cache/i, /box/i, /crate/i, /sack/i,
    /^trophy$/i
  ];
  return !FILTER_GENERIC.some(rx => rx.test(item.rarity)) && !FILTER_GENERIC.some(rx => rx.test(item.name));
}

// === SIMPLE LEVENSHTEIN FUZZY ===
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
