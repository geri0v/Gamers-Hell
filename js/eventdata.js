import { getTpUrl } from './tp.js';
import { fetchWaypoints } from './waypoint.js';

const GOOGLE_SHEET_MAIN_LOOT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?gid=1436649532&single=true&output=csv';
const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv';
const GW2TREASURES_API = 'https://api.gw2treasures.com/items?ids=';

// <-- COLUMN REMAP: change these if your sheet ever changes -->
const COLUMN_MAP = {
  expansion: "Expansion",
  mapName: "MapName",
  location: "Location",
  waypoint: "ClosestWaypoint",
  eventName: "EventName",
  lootBlock: "LootBlock",
  item: "Item",
  itemId: "ItemID",
  rarity: "Rarity",
  guaranteed: "Guaranteed",
  dropRate: "DropRate",
  collectible: "Collectible",
  bound: "AccountBound",
  achievementLinked: "AchievementLinked"
};

const FILTER_CONTAINERS = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i,
  /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i,
];

function isJunkOrContainer(name) {
  if (!name) return false;
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

async function fetchWithRetry(url, options = {}, retries = 3, delay = 500) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    return response;
  } catch (e) {
    if (retries <= 0) throw e;
    await new Promise(res => setTimeout(res, delay));
    return fetchWithRetry(url, options, retries - 1, delay * 2);
  }
}

async function fetchSheetRows() {
  const res = await fetchWithRetry(GOOGLE_SHEET_MAIN_LOOT_CSV_URL);
  const csvText = await res.text();
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
}

async function fetchOtcCsv() {
  try {
    const res = await fetchWithRetry(OTC_CSV_URL);
    const text = await res.text();
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: results => resolve(results.data),
        error: err => reject(err),
      });
    });
  } catch {
    return [];
  }
}

async function fetchGw2TreasuresPrices(itemIds = []) {
  if (!itemIds.length) return {};
  let prices = {};
  const batchSize = 50;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const chunk = itemIds.slice(i, i + batchSize).join(',');
    try {
      const res = await fetchWithRetry(`${GW2TREASURES_API}${chunk}`);
      if (res.ok) {
        const json = await res.json();
        prices = { ...prices, ...json };
      }
    } catch {}
  }
  return prices;
}

// Group and index loot/items per event per map
function buildLootIndex(sheetRows) {
  const lootIndex = {};
  for (const row of sheetRows) {
    const source = row[COLUMN_MAP.eventName] || '';
    if (!lootIndex[source]) lootIndex[source] = [];
    lootIndex[source].push({
      expansion: row[COLUMN_MAP.expansion],
      mapName: row[COLUMN_MAP.mapName],
      location: row[COLUMN_MAP.location],
      waypoint: row[COLUMN_MAP.waypoint],
      eventName: row[COLUMN_MAP.eventName],
      lootBlock: row[COLUMN_MAP.lootBlock],
      item: row[COLUMN_MAP.item],
      itemId: row[COLUMN_MAP.itemId],
      rarity: row[COLUMN_MAP.rarity],
      guaranteed: row[COLUMN_MAP.guaranteed] === 'Yes',
      dropRate: row[COLUMN_MAP.dropRate],
      collectible: row[COLUMN_MAP.collectible] === 'Yes',
      bound: row[COLUMN_MAP.bound] === 'Yes',
      achievementLinked: row[COLUMN_MAP.achievementLinked] === 'Yes',
    });
  }
  return lootIndex;
}

// Filtering logic
function filterLootItems(items) {
  if (!items || items.length === 0) return [];
  const onlyGenericChampBags = items.every(i => /^Champion .* Bag$/i.test(i.item));
  if (onlyGenericChampBags) return items;
  return items.filter(i => {
    if (/^Champion .* Bag$/i.test(i.item)) return false;
    if (i.guaranteed) return true;
    if (!i.rarity) return false;
    const rarity = i.rarity.toLowerCase();
    const collectiblesKeywords = ['mini', 'collection', 'collectible', 'skin'];
    if (rarity.includes('legendary') ||
        rarity.includes('ascended') ||
        rarity.includes('unique') ||
        rarity.includes('rare') ||
        collectiblesKeywords.some(kw => i.item.toLowerCase().includes(kw))) return true;
    return false;
  });
}

// Waypoint proximity if row does not have waypoint
function calculateDistance(a, b) {
  if (!a || !b) return Infinity;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export async function generateDeepEventDataset() {
  const [waypoints, sheetRows, otcRows] = await Promise.all([
    fetchWaypoints(),
    fetchSheetRows(),
    fetchOtcCsv(),
  ]);

  const lootIndex = buildLootIndex(sheetRows);

  // OTC mapping
  const otcNameToId = {};
  otcRows.forEach(({ Name, ID }) => {
    if (Name && ID) otcNameToId[Name] = ID;
  });

  // Collect all loot items names for price fetching
  const allLootItemNames = new Set();
  Object.values(lootIndex).forEach(arr => arr.forEach(i => {
    if (i.item && !isJunkOrContainer(i.item)) allLootItemNames.add(i.item);
  }));
  const uniqueItemIds = [...allLootItemNames].map(name => otcNameToId[name]).filter(Boolean);
  const pricesMap = await fetchGw2TreasuresPrices(uniqueItemIds);

  // Group by map/event
  const eventsByMap = {};
  for (const row of sheetRows) {
    const mapName = row[COLUMN_MAP.mapName] || 'Unknown Map';
    const eventName = row[COLUMN_MAP.eventName] || '';
    if (!eventsByMap[mapName]) eventsByMap[mapName] = {};
    if (!eventsByMap[mapName][eventName]) {
      // If sheet does not have a waypoint but coords and waypoints exist, find the closest
      let assignedWaypoint = row[COLUMN_MAP.waypoint] || '';
      // If you had coordinates to use, add them here & do proximity
      // Example:
      // let eventCoord = row.EventCoordX && row.EventCoordY ? [parseFloat(row.EventCoordX), parseFloat(row.EventCoordY)] : null;
      // if (!assignedWaypoint && eventCoord && waypoints) { ...proximity logic... }

      eventsByMap[mapName][eventName] = {
        name: eventName,
        map: mapName,
        region: row[COLUMN_MAP.expansion] || '',
        expansion: row[COLUMN_MAP.expansion] || '',
        location: row[COLUMN_MAP.location] || '',
        waypoint: assignedWaypoint,
        loot: [],
      };
    }
    // Add loot item:
    eventsByMap[mapName][eventName].loot.push({
      item: row[COLUMN_MAP.item],
      itemId: row[COLUMN_MAP.itemId],
      rarity: row[COLUMN_MAP.rarity],
      guaranteed: row[COLUMN_MAP.guaranteed] === 'Yes',
      dropRate: row[COLUMN_MAP.dropRate],
      collectible: row[COLUMN_MAP.collectible] === 'Yes',
      bound: row[COLUMN_MAP.bound] === 'Yes',
      achievementLinked: row[COLUMN_MAP.achievementLinked] === 'Yes',
    });
  }

  // Filter and enrich loot
  for (const mapEvents of Object.values(eventsByMap)) {
    for (const event of Object.values(mapEvents)) {
      event.loot = filterLootItems(event.loot).map(item => {
        const otcId = otcNameToId[item.item];
        const priceData = otcId && pricesMap[otcId] ? pricesMap[otcId] : {};
        return {
          ...item,
          tp: otcId ? getTpUrl(otcId) : '',
          price: priceData.price || null,
          price_usd: priceData.price_usd || null,
          flags: {
            legendary: /legendary/i.test(item.rarity),
            ascended: /ascended/i.test(item.rarity),
            unique: /unique/i.test(item.rarity),
            rare: /rare/i.test(item.rarity),
            collectible: item.collectible,
            guaranteed: item.guaranteed,
            miniature: /mini/i.test(item.item),
            achievementLinked: item.achievementLinked,
          }
        };
      });
    }
  }

  // Flatten structure for frontend, if needed
  const flatEventsByMap = {};
  for (const [mapName, eventMap] of Object.entries(eventsByMap)) {
    flatEventsByMap[mapName] = Object.values(eventMap);
  }

  return {
    lootIndex,
    eventsByMap: flatEventsByMap,
    waypoints,
    otcItems: otcRows,
    pricesMap,
  };
}
