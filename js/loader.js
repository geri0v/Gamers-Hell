// https://geri0v.github.io/Gamers-Hell/js/loader.js

const itemCache = {};
const priceCache = {};
const wikiCache = {};
let otcPrices = null;
let waypointCache = {};

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

async function getItemPrice(itemId) {
  let price = await fetchItemPriceGW2API(itemId);
  if (price != null) return price;
  const otc = await fetchOTCPrices();
  if (otc && otc[itemId]) return otc[itemId];
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

function waypointChatcodesInEvents(eventArr) {
  const codes = new Set();
  for (const event of eventArr) {
    if (
      (event.code && typeof event.code === "string" && event.code.trim().length > 5)
      || (event.chatcode && typeof event.chatcode === "string" && event.chatcode.trim().length > 5)
    ) {
      if (event.chatcode) codes.add(event.chatcode.trim());
      else codes.add(event.code.trim());
    }
  }
  return Array.from(codes);
}

async function fetchWaypointsByChatcodes(chatcodes) {
  if (!chatcodes.length) return {};
  const toFind = chatcodes.filter(code => !waypointCache[code]);
  if (!toFind.length) return waypointCache;
  const mapIds = await fetchJson('https://api.guildwars2.com/v2/maps');
  if (!mapIds) return waypointCache;
  let codesLeft = new Set(toFind);
  for (let i = 0; i < mapIds.length && codesLeft.size; i += 12) {
    const batch = mapIds.slice(i, i + 12);
    const maps = await Promise.allSettled(batch.map(id => fetchJson(`https://api.guildwars2.com/v2/maps/${id}`)));
    maps.forEach(res => {
      if (res.status === "fulfilled" && res.value && res.value.points_of_interest) {
        Object.values(res.value.points_of_interest).forEach(poi => {
          if (poi.type === 'waypoint' && poi.chat_link && codesLeft.has(poi.chat_link)) {
            waypointCache[poi.chat_link] = {
              name: poi.name,
              wiki: generateWikiLink(poi.name)
            };
            codesLeft.delete(poi.chat_link);
          }
        });
      }
    });
    if (!codesLeft.size) break;
  }
  return waypointCache;
}

export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  return `${gold}g ${silver}s ${copperRemainder}c`;
}

export async function enrichData(events, onProgress) {
  const uniqueItemIds = new Set();
  events.forEach(event => {
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

  // Waypoint enrichment: prefer event.chatcode if present, else event.code
  const chatcodes = waypointChatcodesInEvents(events);
  await fetchWaypointsByChatcodes(chatcodes);

  for (const event of events) {
    event.wikiLink = generateWikiLink(event.name);
    event.mapWikiLink = generateWikiLink(event.map);

    // Fix: For code col: use event.chatcode (if exists), else event.code
    let codeRaw = event.chatcode || event.code || "";
    if (waypointCache[codeRaw]) {
      event.waypointName = waypointCache[codeRaw].name;
      event.waypointWikiLink = waypointCache[codeRaw].wiki;
      event.code = codeRaw; // Always show the code we resolved
    } else {
      event.waypointName = null;
      event.waypointWikiLink = null;
      event.code = codeRaw;
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
  return events;
}
