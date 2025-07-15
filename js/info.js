// info.js — Unified Data Aggregator for GW2 APIs and CSV sources

const GW2TREASURES_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const EXTRA_CSV_SOURCES = [
  // Example: 'https://yourdomain.com/gw2-prices.csv'
];

// Simple in-memory caches
const itemCache = new Map();
const priceCache = new Map();
const waypointCache = new Map();
const wikiDescCache = new Map();

// Utility: Fetch JSON
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

// Utility: Fetch plain text
async function safeFetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    return await res.text();
  } catch {
    return null;
  }
}

// GW2 API — Bulk item details
export async function fetchGW2ItemsBulk(ids) {
  if (!ids.length) return [];
  const chunkSize = 200, results = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/items?ids=${chunk}`);
    if (data) results.push(...data);
  }
  return results;
}

// GW2 API — Bulk price details
export async function fetchGW2PricesBulk(ids) {
  if (!ids.length) return [];
  const chunkSize = 200, results = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk}`);
    if (data) results.push(...data);
  }
  return results;
}

// GW2 Wiki — Plaintext description for items/events/etc.
export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);
  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&exsentences=2&format=json&origin=*&titles=${encodeURIComponent(name)}`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data?.query?.pages) {
    for (const k in data.query.pages) {
      if (data.query.pages[k].extract) desc = data.query.pages[k].extract.trim();
    }
  }
  wikiDescCache.set(name, desc);
  return desc;
}

// GW2Treasures API — Bulk item details
export async function fetchGW2TreasuresBulkItems(ids) {
  if (!ids.length) return [];
  try {
    const res = await fetch("https://api.gw2treasures.com/items/bulk/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GW2TREASURES_BEARER}`
      },
      body: JSON.stringify(ids)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

// GW2Treasures API — Bulk TP prices
export async function fetchGW2TreasuresBulkPrices(ids) {
  if (!ids.length) return [];
  try {
    const res = await fetch("https://api.gw2treasures.com/items/bulk/tp-prices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GW2TREASURES_BEARER}`
      },
      body: JSON.stringify(ids)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

// GW2Treasures API — Bulk container (e.g. chest) contents
export async function fetchGW2TreasuresContainerContents(ids) {
  if (!ids.length) return [];
  try {
    const res = await fetch("https://api.gw2treasures.com/items/bulk/container-contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GW2TREASURES_BEARER}`
      },
      body: JSON.stringify(ids)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

// CSV Fallback (for TP prices)
export async function fetchCSVPrices() {
  let combined = {};
  for (const url of EXTRA_CSV_SOURCES) {
    const text = await safeFetchText(url);
    if (!text) continue;
    const lines = text.split('\n'), header = lines[0].split(',');
    const idIdx = header.indexOf('item_id'), priceIdx = header.indexOf('buy_price');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length > Math.max(idIdx, priceIdx)) {
        const id = parseInt(cols[idIdx]), price = parseInt(cols[priceIdx]);
        if (!isNaN(id) && !isNaN(price)) combined[id] = price;
      }
    }
  }
  return combined;
}

// Waypoint code → human name + wiki link (using official API only)
export async function resolveWaypoints(chatcodes) {
  const uncached = chatcodes.filter(c => !waypointCache.has(c));
  if (!uncached.length) return Object.fromEntries(waypointCache);
  const mapIds = await safeFetchJson('https://api.guildwars2.com/v2/maps');
  if (!mapIds) return Object.fromEntries(waypointCache);
  let codesLeft = new Set(uncached);
  for (let i = 0; i < mapIds.length && codesLeft.size; i += 12) {
    const batch = mapIds.slice(i, i + 12);
    const maps = await Promise.all(batch.map(id => safeFetchJson(`https://api.guildwars2.com/v2/maps/${id}`)));
    for (const map of maps) {
      if (!map?.points_of_interest) continue;
      for (const poi of Object.values(map.points_of_interest)) {
        if (poi.type === 'waypoint' && poi.chat_link && codesLeft.has(poi.chat_link)) {
          waypointCache.set(poi.chat_link, {
            name: poi.name,
            wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(poi.name.replace(/ /g, "_"))}`
          });
          codesLeft.delete(poi.chat_link);
        }
      }
      if (codesLeft.size === 0) break;
    }
  }
  return Object.fromEntries(waypointCache);
}

// Core enrichment: Official API → Wiki → GW2Treasures → CSV fallback (for prices)
// Output: array of item objects with price field filled in
export async function enrichItemsAndPrices(itemIds) {
  let items = await fetchGW2ItemsBulk(itemIds);
  let prices = await fetchGW2PricesBulk(itemIds);

  if (!items?.length) items = await fetchGW2TreasuresBulkItems(itemIds) || [];
  if (!prices?.length) prices = await fetchGW2TreasuresBulkPrices(itemIds) || [];

  let csvPrices = {};
  if (!prices?.length) csvPrices = await fetchCSVPrices();

  const priceMap = new Map();
  if (prices) prices.forEach(p => { if (p && p.id != null) priceMap.set(p.id, p.sells ? p.sells.unit_price : null); });
  if (csvPrices) Object.entries(csvPrices).forEach(([id, price]) => { if (!priceMap.has(Number(id))) priceMap.set(Number(id), price); });

  return (items || []).map(item => ({
    ...item,
    price: priceMap.get(item.id) || null
  }));
}

// Container/bundle enrichment
export async function enrichContainerContents(containerIds) {
  let contents = await fetchGW2TreasuresContainerContents(containerIds);
  if (!contents) contents = [];
  return contents;
}

// Currency formatting utility (for use in render/UI)
export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  return `${gold}g ${silver}s ${copperRemainder}c`;
}
