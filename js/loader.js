// https://geri0v.github.io/Gamers-Hell/js/loader.js

const itemCache = {};
const priceCache = {};
const wikiCache = {};
let waypointMap = null; // Will hold code -> {name, wiki} mapping
let otcPrices = null; // Will hold OTC CSV prices mapping

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch { return null; }
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
  } catch { return null; }
}

async function fetchItemDetails(itemId) {
  if (itemCache[itemId]) return itemCache[itemId];
  const data = await fetchJson(`https://api.guildwars2.com/v2/items/${itemId}`);
  if (data) itemCache[itemId] = data;
  return data;
}

async function fetchItemPriceGW2API(itemId) {
  if (priceCache[itemId]) return priceCache[itemId];
  const data = await fetchJson(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
  if (data && data.sells) priceCache[itemId] = data.sells.unit_price;
  return priceCache[itemId] || null;
}

async function fetchOTCPrices() {
  if (otcPrices) return otcPrices;
  const csvUrl = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv';
  const csvText = await fetchText(csvUrl);
  if (!csvText) return null;
  otcPrices = parseCSVPrices(csvText);
  return otcPrices;
}

function parseCSVPrices(csvText) {
  // Simple CSV parse: expects columns with item_id and buy_price (copper)
  const lines = csvText.split('\n');
  const header = lines[0].split(',');
  const idIndex = header.indexOf('item_id');
  const priceIndex = header.indexOf('buy_price');
  if (idIndex === -1 || priceIndex === -1) return null;
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= Math.max(idIndex, priceIndex)) continue;
    const id = parseInt(cols[idIndex], 10);
    const price = parseInt(cols[priceIndex], 10);
    if (!isNaN(id) && !isNaN(price)) {
      map[id] = price;
    }
  }
  return map;
}

async function fetchWaypointMap() {
  if (waypointMap) return waypointMap;
  waypointMap = {};
  // Fetch all continents to get map IDs
  const continents = await fetchJson('https://api.guildwars2.com/v2/continents');
  if (!continents) return waypointMap;
  // For each continent, fetch floors
  for (const continentId of continents) {
    const floors = await fetchJson(`https://api.guildwars2.com/v2/continents/${continentId}/floors`);
    if (!floors) continue;
    for (const floorId of floors) {
      const floorData = await fetchJson(`https://api.guildwars2.com/v2/continents/${continentId}/floors/${floorId}`);
      if (!floorData || !floorData.points_of_interest) continue;
      for (const poi of floorData.points_of_interest) {
        if (poi.type === 'Waypoint' || poi.type === 'waypoint') {
          // Generate chat code for waypoint
          // Unfortunately, chat code is not directly given, so we skip code generation here
          // Instead, we use the name and build the wiki link, and map by name
          waypointMap[poi.name] = {
            name: poi.name,
            wiki: generateWikiLink(poi.name)
          };
        }
      }
    }
  }
  return waypointMap;
}

function generateWikiLink(name) {
  if (!name) return null;
  if (wikiCache[name]) return wikiCache[name];
  const baseUrl = 'https://wiki.guildwars2.com/wiki/';
  const encoded = encodeURIComponent(name.replace(/ /g, '_'));
  const link = `${baseUrl}${encoded}`;
  wikiCache[name] = link;
  return link;
}

export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  return `${gold}g ${silver}s ${copperRemainder}c`;
}

async function fetchPriceGW2BLTC(itemId) {
  // GW2BLTC API endpoint example: https://www.gw2bltc.com/api/v2/price/{itemId}
  // CORS may block this, so we try but fallback if fails
  try {
    const response = await fetch(`https://www.gw2bltc.com/api/v2/price/${itemId}`);
    if (!response.ok) throw new Error('GW2BLTC fetch failed');
    const data = await response.json();
    if (data && data.price) return data.price;
  } catch {
    return null;
  }
  return null;
}

async function fetchPriceGW2Spidy(itemId) {
  // GW2Spidy API example: https://www.gw2spidy.com/api/v0.9/json/item/{itemId}
  // CORS may block this as well
  try {
    const response = await fetch(`https://www.gw2spidy.com/api/v0.9/json/item/${itemId}`);
    if (!response.ok) throw new Error('GW2Spidy fetch failed');
    const data = await response.json();
    if (data && data.item && data.item.sells && data.item.sells.unit_price) return data.item.sells.unit_price;
  } catch {
    return null;
  }
  return null;
}

async function getItemPrice(itemId) {
  // Try GW2 API first
  let price = await fetchItemPriceGW2API(itemId);
  if (price != null) return price;

  // Then try GW2BLTC
  price = await fetchPriceGW2BLTC(itemId);
  if (price != null) return price;

  // Then try GW2Spidy
  price = await fetchPriceGW2Spidy(itemId);
  if (price != null) return price;

  // Then try OTC CSV
  const otc = await fetchOTCPrices();
  if (otc && otc[itemId]) return otc[itemId];

  return null;
}

export async function enrichData(data, onProgress) {
  // Gather all unique item IDs
  const uniqueItemIds = new Set();
  data.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => {
        if (item.id) uniqueItemIds.add(item.id);
      });
    }
  });

  // Fetch all unique item details in advance
  const itemDetailsPromises = Array.from(uniqueItemIds).map(id => fetchItemDetails(id));
  const itemDetailsResults = await Promise.all(itemDetailsPromises);

  // Fetch prices with fallback logic
  const pricePromises = Array.from(uniqueItemIds).map(id => getItemPrice(id));
  const priceResults = await Promise.all(pricePromises);

  // Map item details and prices for quick lookup
  const detailsMap = {};
  Array.from(uniqueItemIds).forEach((id, i) => {
    detailsMap[id] = itemDetailsResults[i] || {};
    if (priceResults[i] != null) detailsMap[id].price = priceResults[i];
  });

  // Fetch waypoint mapping dynamically
  const waypointMapping = await fetchWaypointMap();

  // Enrich each event/loot item
  for (const event of data) {
    event.wikiLink = generateWikiLink(event.name);
    event.mapWikiLink = generateWikiLink(event.map);

    // Attempt to enrich waypointName and waypointWikiLink by matching event.code to waypoint names
    // Since we don't have chat codes from API, we try to match by event name or map name heuristics
    // This is a best-effort fallback; you can improve with a manual mapping if needed
    event.waypointName = null;
    event.waypointWikiLink = null;
    if (event.code) {
      // Try to find a waypoint in mapping whose name is included in event name or map
      for (const wpName in waypointMapping) {
        if (event.name && event.name.includes(wpName) || event.map && event.map.includes(wpName)) {
          event.waypointName = waypointMapping[wpName].name;
          event.waypointWikiLink = waypointMapping[wpName].wiki;
          break;
        }
      }
    }

    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => {
        if (item.id && detailsMap[item.id]) {
          const details = detailsMap[item.id];
          item.icon = details.icon;
          item.wikiLink = generateWikiLink(details.name);
          item.accountBound = details.flags ? details.flags.includes('AccountBound') : false;
          item.chatCode = details.chat_link || null;
          item.price = details.price || null;
          item.vendorValue = details.vendor_value ? details.vendor_value : null;
        } else {
          item.wikiLink = generateWikiLink(item.name);
        }
        item.guaranteed = !!item.guaranteed;
      });
    }
    if (onProgress) onProgress(event);
  }
  return data;
}
