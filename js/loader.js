// https://geri0v.github.io/Gamers-Hell/js/loader.js

const itemCache = {};
const priceCache = {};
const wikiCache = {};
let otcPrices = null;
let metaBattleData = null;

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

async function fetchPriceGW2BLTC(itemId) {
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

async function fetchMetaBattleData() {
  if (metaBattleData) return metaBattleData;
  // Example MetaBattle API endpoint (replace with actual if available)
  const url = 'https://api.metabattle.com/v1/items'; // Hypothetical
  try {
    const data = await fetchJson(url);
    metaBattleData = data || null;
    return metaBattleData;
  } catch {
    return null;
  }
}

async function getItemPrice(itemId) {
  // Try GW2 API first
  let price = await fetchItemPriceGW2API(itemId);
  if (price != null) return price;

  // Then OTC CSV
  const otc = await fetchOTCPrices();
  if (otc && otc[itemId]) return otc[itemId];

  // Then GW2BLTC
  price = await fetchPriceGW2BLTC(itemId);
  if (price != null) return price;

  // Then GW2Spidy
  price = await fetchPriceGW2Spidy(itemId);
  if (price != null) return price;

  // Then MetaBattle
  const meta = await fetchMetaBattleData();
  if (meta && meta[itemId] && meta[itemId].price) return meta[itemId].price;

  return null;
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

export async function enrichData(data, onProgress) {
  const uniqueItemIds = new Set();
  data.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => {
        if (item.id) uniqueItemIds.add(item.id);
      });
    }
  });

  const itemDetailsPromises = Array.from(uniqueItemIds).map(id => fetchItemDetails(id));
  const itemDetailsResults = await Promise.all(itemDetailsPromises);

  const pricePromises = Array.from(uniqueItemIds).map(id => getItemPrice(id));
  const priceResults = await Promise.all(pricePromises);

  const detailsMap = {};
  Array.from(uniqueItemIds).forEach((id, i) => {
    detailsMap[id] = itemDetailsResults[i] || {};
    if (priceResults[i] != null) detailsMap[id].price = priceResults[i];
  });

  // Enrich each event
  for (const event of data) {
    // Enrich event icon if available (optional: from API or MetaBattle if available)
    event.wikiLink = generateWikiLink(event.name);
    event.mapWikiLink = generateWikiLink(event.map);

    // Enrich waypoint name and wiki link dynamically if available in JSON or fetched (fallback logic can be added here)
    // For now, assume waypointName and waypointWikiLink are in JSON or can be enriched similarly
    if (event.waypointName) {
      event.waypointWikiLink = generateWikiLink(event.waypointName);
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
