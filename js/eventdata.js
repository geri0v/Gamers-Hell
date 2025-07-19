// eventdata.js

import { getTpUrl } from './tp.js';
import { fetchWaypoints } from './waypoint.js';

// Alleen het Main_Loot tabblad word geladen:
const GOOGLE_SHEET_MAIN_LOOT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?gid=1436649532&single=true&output=csv';
const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/refs/heads/master/items.csv';
const GW2TREASURES_API = 'https://api.gw2treasures.com/items?ids=';

// Sheet kolommen mapping — pas alleen aan als sheetschema wijzigt
const COLUMNS = {
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

// Extra filtering: alleen rijen waar minimaal één veld niet leeg is
function filterNonEmptyRows(rows) {
  return rows.filter(row =>
    Object.values(row)
      .map(v => (v ?? '').trim())
      .some(v => v !== '')
  );
}

// OTC CSV
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

// Gw2Treasures prijzen
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

// Loot index bouwen per event
function buildLootIndex(sheetRows) {
  const lootIndex = {};
  for (const row of sheetRows) {
    const source = row[COLUMNS.eventName] || '';
    if (!lootIndex[source]) lootIndex[source] = [];
    lootIndex[source].push({
      expansion: row[COLUMNS.expansion],
      mapName: row[COLUMNS.mapName],
      location: row[COLUMNS.location],
      waypoint: row[COLUMNS.waypoint],
      eventName: row[COLUMNS.eventName],
      lootBlock: row[COLUMNS.lootBlock],
      item: row[COLUMNS.item],
      itemId: row[COLUMNS.itemId],
      rarity: row[COLUMNS.rarity],
      guaranteed: row[COLUMNS.guaranteed] === 'Yes',
      dropRate: row[COLUMNS.dropRate],
      collectible: row[COLUMNS.collectible] === 'Yes',
      bound: row[COLUMNS.bound] === 'Yes',
      achievementLinked: row[COLUMNS.achievementLinked] === 'Yes',
    });
  }
  return lootIndex;
}

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

  // Extra filtering: alleen rows met echte data
  const cleanRows = filterNonEmptyRows(sheetRows);

  const lootIndex = buildLootIndex(cleanRows);

  // OTC koppeling (naam → id)
  const otcNameToId = {};
  otcRows.forEach(({ Name, ID }) => {
    if (Name && ID) otcNameToId[Name] = ID;
  });

  // Unieke itemnamen voor prijzen
  const allLootItemNames = new Set();
  Object.values(lootIndex).forEach(arr => arr.forEach(i => {
    if (i.item && !isJunkOrContainer(i.item)) allLootItemNames.add(i.item);
  }));
  const uniqueItemIds = [...allLootItemNames].map(name => otcNameToId[name]).filter(Boolean);
  const pricesMap = await fetchGw2TreasuresPrices(uniqueItemIds);

  // eventsByMap vullen
  const eventsByMap = {};
  for (const row of cleanRows) {
    const mapName = row[COLUMNS.mapName] || 'Unknown Map';
    const eventName = row[COLUMNS.eventName] || '';
    if (!eventsByMap[mapName]) eventsByMap[mapName] = {};
    if (!eventsByMap[mapName][eventName]) {
      // Waypoint: direct uit sheet. Eventueel locatie/coord logica kun je toevoegen)
      let assignedWaypoint = row[COLUMNS.waypoint] || '';
      eventsByMap[mapName][eventName] = {
        name: eventName,
        map: mapName,
        region: row[COLUMNS.expansion] || '',
        expansion: row[COLUMNS.expansion] || '',
        location: row[COLUMNS.location] || '',
        waypoint: assignedWaypoint,
        loot: [],
      };
    }
    // Voeg loot toe
    eventsByMap[mapName][eventName].loot.push({
      item: row[COLUMNS.item],
      itemId: row[COLUMNS.itemId],
      rarity: row[COLUMNS.rarity],
      guaranteed: row[COLUMNS.guaranteed] === 'Yes',
      dropRate: row[COLUMNS.dropRate],
      collectible: row[COLUMNS.collectible] === 'Yes',
      bound: row[COLUMNS.bound] === 'Yes',
      achievementLinked: row[COLUMNS.achievementLinked] === 'Yes',
    });
  }

  // Verrijk loot
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

  // Flatten structuur ter output
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
