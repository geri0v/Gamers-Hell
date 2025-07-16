// info.js — Unified Data Aggregator for GW2 APIs (Official, Wiki, GW2Treasures) + Fallback CSV support

const GW2TREASURES_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const EXTRA_CSV_SOURCES = [
  // Add CSV URLs here to fallback e.g. 'https://yourdomain.com/prices.csv'
];

const itemCache = new Map();
const priceCache = new Map();
const waypointCache = new Map();
const wikiDescCache = new Map();

// General fetch wrappers
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

// 📦 Main API integrations

// ➤ Official GW2 API
export async function fetchGW2ItemsBulk(ids) {
  if (!ids.length) return [];
  const results = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/items?ids=${chunk}`);
    if (data) results.push(...data);
  }
  return results;
}

export async function fetchGW2PricesBulk(ids) {
  if (!ids.length) return [];
  const results = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk}`);
    if (data) results.push(...data);
  }
  return results;
}

// ➤ GW2Treasures Bulk Endpoints
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
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

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
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// For future: container contents / mystic forge
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
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ➤ Wiki Descriptions (return just 2 sentences)
export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);
  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&exsentences=3&format=json&origin=*&titles=${encodeURIComponent(name)}`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data?.query?.pages) {
    for (const k in data.query.pages) {
      if (data.query.pages[k].extract) {
        desc = data.query.pages[k].extract.trim().split('. ').slice(0,2).join('. ') + '.';
      }
    }
  }
  wikiDescCache.set(name, desc);
  return desc;
}

// ➤ Waypoint Resolver
export async function resolveWaypoints(chatcodes) {
  const uncached = chatcodes.filter(c => !waypointCache.has(c));
  if (!uncached.length) return Object.fromEntries(waypointCache);
  const mapIds = await safeFetchJson(`https://api.guildwars2.com/v2/maps`);
  if (!mapIds) return Object.fromEntries(waypointCache);
  let codesLeft = new Set(uncached);
  for (let i = 0; i < mapIds.length && codesLeft.size > 0; i += 12) {
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
    }
  }
  return Object.fromEntries(waypointCache);
}

// ➤ CSV fallback (for TP prices)
export async function fetchCSVPrices() {
  let prices = {};
  for (const url of EXTRA_CSV_SOURCES) {
    const text = await safeFetchText(url);
    if (!text) continue;
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    const idIndex = headers.indexOf('item_id');
    const priceIndex = headers.indexOf('buy_price');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const id = parseInt(cols[idIndex]);
      const price = parseInt(cols[priceIndex]);
      if (!isNaN(id) && !isNaN(price)) prices[id] = price;
    }
  }
  return prices;
}

// ➤ Price formatter
export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  return `${gold}g ${silver}s ${copperRemainder}c`;
}

// 🔗 Unified item enrichment function (with fallback structure)
export async function enrichItemsAndPrices(itemIds) {
  const items = await fetchGW2ItemsBulk(itemIds) || await fetchGW2TreasuresBulkItems(itemIds) || [];
  const prices = await fetchGW2PricesBulk(itemIds) || await fetchGW2TreasuresBulkPrices(itemIds) || [];
  const csvPrices = await fetchCSVPrices();

  const priceMap = new Map();
  prices.forEach(p => {
    const id = p.id;
    const value = p.sells?.unit_price || p.buy?.unit_price || null;
    priceMap.set(id, value);
  });
  for (const [id, price] of Object.entries(csvPrices)) {
    if (!priceMap.has(Number(id))) priceMap.set(Number(id), price);
  }

  return items.map(item => ({
    ...item,
    price: priceMap.get(item.id) ?? null
  }));
}

// ➤ Container enrichment (currently not rendered in UI, hooks ready)
export async function enrichContainerContents(containerIds) {
  const contents = await fetchGW2TreasuresContainerContents(containerIds);
  return contents || [];
}
