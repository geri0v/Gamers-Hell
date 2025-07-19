import { getTpUrl } from './tp.js';
import { fetchWaypoints } from './waypoint.js';

// ONLY fetch the Main_Loot tab (gid=1436649532)
const GOOGLE_SHEET_MAIN_LOOT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?gid=1436649532&single=true&output=csv';
const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv';
const GW2TREASURES_API = 'https://api.gw2treasures.com/items?ids=';

// Regex patterns for filtering generic container/junk items
const FILTER_CONTAINERS = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i,
  /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i,
];

// Helper: checks if loot item is generic container/junk
function isJunkOrContainer(name) {
  if (!name) return false;
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

// Helper: Robust fetch with retries
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

// Fetch loot/event/map data from Main_Loot tab
async function fetchLootDataFromCsv() {
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

// Fetch OTC CSV used for item ID and price mapping
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

// Fetch prices from Gw2Treasures by batched item ID list
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
    } catch {
      // Ignore fetch failures per batch
    }
  }
  return prices;
}

// Organizes Sheet CSV rows into loot index keyed by source (event/chest/etc)
function buildLootIndex(sheetRows) {
  const lootIndex = {};
  for (const row of sheetRows) {
    const source = row['Event/Chest'] || row.EventName || row['Event/Meta Name'] || '';
    if (!lootIndex[source]) lootIndex[source] = [];
    lootIndex[source].push({
      mapName: row.MapName,
      mapId: row.MapID,
      waypoint: row.Waypoint,
      eventId: row.EventID,
      sourceType: row.SourceType || source,
      item: row.Item,
      rarity: row.Rarity,
      guaranteed: row.Guaranteed === 'Yes',
      collectible: row.Collectible === 'Yes',
      bound: row.Bound === 'Yes' || row['Account Bound'] === 'Yes',
      achievementLinked: row.AchievementLinked === 'Yes',
      tpLink: row.TPLink,
      wikiLink: row.WikiLink,
      timestamp: row.Timestamp,
      coord: (row.EventCoordX && row.EventCoordY) ?
              [parseFloat(row.EventCoordX), parseFloat(row.EventCoordY)] : null,
    });
  }
  return lootIndex;
}

// Filters loot to include unique, rare, guaranteed,
// collectibles, minis, achievements; excludes generic champ bags unless only loot
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

// Calculate Euclidean distance for waypoint proximity
function calculateDistance(a, b) {
  if (!a || !b) return Infinity;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Main function: fetches all data, deeply merges, enriches, applies flags & filtering
export async function generateDeepEventDataset() {
  const [waypoints, sheetRows, otcRows] = await Promise.all([
    fetchWaypoints(),
    fetchLootDataFromCsv(),
    fetchOtcCsv(),
  ]);

  // Build loot index from sheet
  const lootIndex = buildLootIndex(sheetRows);

  // OTC item name → ID map for price lookup
  const otcNameToId = {};
  otcRows.forEach(({ Name, ID }) => {
    if (Name && ID) otcNameToId[Name] = ID;
  });

  // Collect all loot items names to fetch prices
  const allLootItemNames = new Set();
  Object.values(lootIndex).forEach(arr => arr.forEach(i => {
    if (i.item && !isJunkOrContainer(i.item)) allLootItemNames.add(i.item);
  }));
  const uniqueItemIds = [...allLootItemNames].map(name => otcNameToId[name]).filter(Boolean);
  const pricesMap = await fetchGw2TreasuresPrices(uniqueItemIds);

  // Organize by maps
  const mapByName = {};
  sheetRows.forEach(row => {
    if (!mapByName[row.MapName]) mapByName[row.MapName] = {
      name: row.MapName,
      region: row.Region || row.Expansion || 'Unknown',
      expansion: row.Expansion || 'Core',
      id: row.MapID,
      events: {},
    };
  });

  // Organize events per map from the sheet data
  for (const row of sheetRows) {
    const map = mapByName[row.MapName];
    if (!map) continue;

    const eventId = row.EventID || row['Event/Meta Name'] || row.EventName || row['Event/Chest'] || '';
    if (!map.events[eventId]) {
      // Find closest waypoint if only coordinates present, else use row.Waypoint
      let eventWaypoint = row.Waypoint || '';
      const eventCoord = (row.EventCoordX && row.EventCoordY)
        ? [parseFloat(row.EventCoordX), parseFloat(row.EventCoordY)]
        : null;
      if (!eventWaypoint && eventCoord && waypoints && waypoints.length) {
        let closest = null, minDist = Infinity;
        for (const wp of waypoints) {
          if (wp.type !== 'Waypoint' || wp.map_id !== row.MapID) continue;
          const dist = calculateDistance(eventCoord, wp.coord);
          if (dist < minDist) { minDist = dist; closest = wp; }
        }
        if (closest) eventWaypoint = closest.chat_code || closest.name;
      }

      map.events[eventId] = {
        id: eventId,
        name: row['Event/Meta Name'] || row.EventName || row['Event/Chest'] || '',
        map: map.name,
        region: map.region,
        expansion: map.expansion,
        level: row.Level || null,
        waypoint: eventWaypoint,
        loot: [],
      };
    }

    // Push loot entries for this event
    map.events[eventId].loot.push({
      item: row.Item,
      rarity: row.Rarity,
      guaranteed: row.Guaranteed === 'Yes',
      collectible: row.Collectible === 'Yes',
      bound: row.Bound === 'Yes' || row['Account Bound'] === 'Yes',
      achievementLinked: row.AchievementLinked === 'Yes',
      tpLink: row.TPLink,
      wikiLink: row.WikiLink,
      timestamp: row.Timestamp,
    });
  }

  // Now, filter/enrich loot
  for (const map of Object.values(mapByName)) {
    for (const event of Object.values(map.events)) {
      event.loot = filterLootItems(event.loot).map(item => {
        const otcId = otcNameToId[item.item];
        const priceData = otcId && pricesMap[otcId] ? pricesMap[otcId] : {};
        return {
          ...item,
          tp: item.tpLink || (otcId ? getTpUrl(otcId) : ''),
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

  // Organize eventsByMap: { mapName: [eventObject, ...], ... }
  const eventsByMap = {};
  for (const [mapName, map] of Object.entries(mapByName)) {
    eventsByMap[mapName] = Object.values(map.events);
  }

  return {
    maps: Object.values(mapByName),
    waypoints,
    lootIndex,
    otcItems: otcRows,
    pricesMap,
    eventsByMap,
  };
}
