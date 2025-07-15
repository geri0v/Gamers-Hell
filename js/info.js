// info.js — Unified Data Aggregator for GW2

const GW2TREASURES_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const EXTRA_CSV_SOURCES = [
  // e.g., 'https://yourdomain.com/gw2-prices.csv'
];

const itemCache = new Map();
const priceCache = new Map();
const waypointCache = new Map();
const wikiDescCache = new Map();

//---- Utility Fetchers ----//
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    return await res.text();
  } catch {
    return null;
  }
}

//---- GW2 Official API ----//
async function fetchGW2ItemsBulk(ids) {
  if (!ids.length) return [];
  const chunkSize = 200;
  let results = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize).join(",");
    const url = `https://api.guildwars2.com/v2/items?ids=${chunk}`;
    const data = await safeFetchJson(url);
    if (data) results = results.concat(data);
  }
  return results;
}

async function fetchGW2PricesBulk(ids) {
  if (!ids.length) return [];
  const chunkSize = 200;
  let results = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize).join(",");
    const url = `https://api.guildwars2.com/v2/commerce/prices?ids=${chunk}`;
    const data = await safeFetchJson(url);
    if (data) results = results.concat(data);
  }
  return results;
}

//---- Wiki (for descriptions only) ----//
async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);
  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&exsentences=2&format=json&origin=*&titles=${encodeURIComponent(name)}`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data && data.query && data.query.pages) {
    for (const k in data.query.pages) {
      if (data.query.pages[k].extract) desc = data.query.pages[k].extract.trim();
    }
  }
  wikiDescCache.set(name, desc);
  return desc;
}

//---- GW2Treasures API (correct per-endpoint use) ----//
async function fetchGW2TreasuresBulkItems(ids) {
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

async function fetchGW2TreasuresBulkPrices(ids) {
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

async function fetchGW2TreasuresContainerContents(ids) {
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

//---- Public CSV Fallback ----//
async function fetchCSVPrices() {
  let combined = {};
  for (const url of EXTRA_CSV_SOURCES) {
    try {
      const text = await safeFetchText(url);
      if (!text) continue;
      const lines = text.split('\n');
      const header = lines[0].split(',');
      const idIdx = header.indexOf('item_id'), priceIdx = header.indexOf('buy_price');
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length <= Math.max(idIdx, priceIdx)) continue;
        const id = parseInt(cols[idIdx]), price = parseInt(cols[priceIdx]);
        if (!isNaN(id) && !isNaN(price)) combined[id] = price;
      }
    } catch {}
  }
  return combined;
}

//---- Waypoint Code to Name (Official API only) ----//
async function resolveWaypoints(chatcodes) {
  const uncached = chatcodes.filter(c => !waypointCache.has(c));
  if (!uncached.length) return Object.fromEntries(waypointCache);
  const mapIds = await safeFetchJson('https://api.guildwars2.com/v2/maps');
  if (!mapIds) return Object.fromEntries(waypointCache);
  let codesLeft = new Set(uncached);
  for (let i = 0; i < mapIds.length && codesLeft.size; i += 12) {
    const batch = mapIds.slice(i, i + 12);
    const maps = await Promise.all(batch.map(id => safeFetchJson(`https://api.guildwars2.com/v2/maps/${id}`)));
    for (const map of maps) {
      if (!map || !map.points_of_interest) continue;
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

//---- Core Aggregator (strict preference: API > wiki > GW2Treasures > CSV) ----//
export async function enrichItemsAndPrices(itemIds) {
  // 1. Try Official API
  let items = await fetchGW2ItemsBulk(itemIds);
  let prices = await fetchGW2PricesBulk(itemIds);

  // 2. If anything missing, try wiki for descriptions (optional, per-item or post-process)
  // [Handled by consumer; not bulk for all items here.]

  // 3. If missing, try GW2Treasures API
  if (!items || !items.length) items = await fetchGW2TreasuresBulkItems(itemIds) || [];
  if (!prices || !prices.length) prices = await fetchGW2TreasuresBulkPrices(itemIds) || [];

  // 4. Final fallback: CSVs for prices only
  let csvPrices = {};
  if (!prices || prices.length === 0) {
    csvPrices = await fetchCSVPrices();
  }

  // Merge all
  const priceMap = new Map();
  if (prices) {
    for (const p of prices) {
      if (p && p.id != null) priceMap.set(p.id, p.sells ? p.sells.unit_price : null);
    }
  }
  if (csvPrices) {
    for (const [id, price] of Object.entries(csvPrices)) {
      if (!priceMap.has(Number(id))) priceMap.set(Number(id), price);
    }
  }

  // Output always in unified format
  return (items || []).map(item => ({
    ...item,
    price: priceMap.get(item.id) || null
  }));
}

//---- Containers/Boxes support (strict preference order) ----//
export async function enrichContainerContents(containerIds) {
  let contents = await fetchGW2TreasuresContainerContents(containerIds);
  if (!contents) contents = [];
  return contents;
}

export {
  fetchGW2ItemsBulk,
  fetchGW2PricesBulk,
  fetchGW2TreasuresBulkItems,
  fetchGW2TreasuresBulkPrices,
  fetchGW2TreasuresContainerContents,
  fetchCSVPrices,
  fetchWikiDescription,
  resolveWaypoints,
  enrichItemsAndPrices,
  enrichContainerContents
};
