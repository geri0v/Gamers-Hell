// info.js — Unified Data Aggregator for GW2 APIs (Official + GW2Treasures) + CSV fallback

const GW2TREASURES_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const EXTRA_CSV_SOURCES = [
  // e.g., 'https://example.com/custom-prices.csv'
];

const itemCache = new Map();
const priceCache = new Map();
const waypointCache = new Map();
const wikiDescCache = new Map();

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

// GW2 API: Items + Prices
export async function fetchGW2ItemsBulk(ids) {
  const chunked = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/items?ids=${chunk}`);
    if (data) chunked.push(...data);
  }
  return chunked;
}

export async function fetchGW2PricesBulk(ids) {
  const chunked = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk}`);
    if (data) chunked.push(...data);
  }
  return chunked;
}

// GW2Treasures API
export async function fetchGW2TreasuresBulkItems(ids) {
  if (!ids.length) return [];
  const res = await fetch("https://api.gw2treasures.com/items/bulk/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GW2TREASURES_BEARER}`
    },
    body: JSON.stringify(ids)
  });
  return res.ok ? await res.json() : [];
}

export async function fetchGW2TreasuresBulkPrices(ids) {
  if (!ids.length) return [];
  const res = await fetch("https://api.gw2treasures.com/items/bulk/tp-prices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GW2TREASURES_BEARER}`
    },
    body: JSON.stringify(ids)
  });
  return res.ok ? await res.json() : [];
}

export async function fetchGW2TreasuresContainerContents(ids) {
  if (!ids.length) return [];
  const res = await fetch("https://api.gw2treasures.com/items/bulk/container-contents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GW2TREASURES_BEARER}`
    },
    body: JSON.stringify(ids)
  });
  return res.ok ? await res.json() : [];
}

export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);
  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${encodeURIComponent(name)}&exsentences=2`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data?.query?.pages) {
    for (const key in data.query.pages) {
      if (data.query.pages[key].extract) {
        desc = data.query.pages[key].extract.trim();
        break;
      }
    }
  }
  wikiDescCache.set(name, desc);
  return desc;
}

// ✅ FIXED 429: Batched call to /maps?ids=...
export async function resolveWaypoints(chatcodes) {
  const uncached = chatcodes.filter(c => !waypointCache.has(c));
  if (!uncached.length) return Object.fromEntries(waypointCache);

  const mapIds = await safeFetchJson('https://api.guildwars2.com/v2/maps');
  if (!mapIds) return Object.fromEntries(waypointCache);

  let codesLeft = new Set(uncached);

  for (let i = 0; i < mapIds.length && codesLeft.size; i += 50) {
    const batch = mapIds.slice(i, i + 50).join(',');
    const maps = await safeFetchJson(`https://api.guildwars2.com/v2/maps?ids=${batch}`);
    if (!maps) continue;

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
    }
    if (codesLeft.size === 0) break;
  }

  return Object.fromEntries(waypointCache);
}

// CSV fallback
export async function fetchCSVPrices() {
  let prices = {};
  for (const url of EXTRA_CSV_SOURCES) {
    const text = await safeFetchText(url);
    if (!text) continue;
    const lines = text.split('\n');
    const [header, ...data] = lines;
    const headers = header.split(',');
    const idIdx = headers.indexOf('item_id');
    const priceIdx = headers.indexOf('buy_price');
    data.forEach(row => {
      const cols = row.split(',');
      const id = parseInt(cols[idIdx]);
      const price = parseInt(cols[priceIdx]);
      if (!isNaN(id) && !isNaN(price)) prices[id] = price;
    });
  }
  return prices;
}

// 💰 formatPrice
export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}

// 🔗 Merge Enrichment
export async function enrichItemsAndPrices(itemIds) {
  const items = await fetchGW2ItemsBulk(itemIds) || [];
  const prices = await fetchGW2PricesBulk(itemIds) || [];
  const altItems = items.length ? items : await fetchGW2TreasuresBulkItems(itemIds) || [];
  const altPrices = prices.length ? prices : await fetchGW2TreasuresBulkPrices(itemIds) || [];
  const csvPrices = await fetchCSVPrices();

  const priceMap = new Map();
  [...altPrices, ...prices].forEach(p => {
    const price = p.sells?.unit_price || p.buy?.unit_price;
    if (p.id != null) priceMap.set(p.id, price);
  });

  for (const [id, price] of Object.entries(csvPrices)) {
    if (!priceMap.has(Number(id))) priceMap.set(Number(id), price);
  }

  return (altItems || items).map(item => ({
    ...item,
    price: priceMap.get(item.id) ?? null
  }));
}

export async function enrichContainerContents(containerIds) {
  const contents = await fetchGW2TreasuresContainerContents(containerIds);
  return contents || [];
}
