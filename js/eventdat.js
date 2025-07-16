// eventdata.js — FINAL VERSION (Full deep loot parser for all events)

import { getTpUrl } from './tp.js';
import { getChatCode } from './event.js';

// ----------------------------------
// CONFIG / UTIL
// ----------------------------------

const WIKI_BASE = 'https://wiki.guildwars2.com/wiki/';
const EVENT_API = 'https://api.guildwars2.com/v1/event_details.json';
const MAPS_API = 'https://api.guildwars2.com/v2/maps';

// Helper: Delay (for polite fetch timing)
const wait = ms => new Promise(r => setTimeout(r, ms));

// Remove generic containers/junk
function isWorthwhileItem(name) {
  const junk = [
    "Bag of", "Trophy", "Pouch", "Box of", "Battered", "Worn", "Cracked",
    "Sack of", "Minor", "Scroll", "Generic", "Champion Bag", "Pile", "Shard", "Junk"
  ];
  return !junk.some(sub => name.includes(sub));
}

// Parse loot text table from raw Wiki HTML into JS item structure
function parseLootTable(htmlText) {
  const items = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const rows = [...doc.querySelectorAll('table.wikitable tbody tr')];

  for (const row of rows) {
    const cols = row.querySelectorAll('td');
    const nameLink = row.querySelector('td a[href]');

    if (!cols.length || !nameLink) continue;

    const name = nameLink?.textContent.trim();
    if (!isWorthwhileItem(name)) continue;

    const href = nameLink?.getAttribute('href');
    const wikiUrl = href?.startsWith('/') ? `https://wiki.guildwars2.com${href}` : href;
    const chatcode = cols[1]?.innerText?.trim() || null;
    const rarity = cols[2]?.innerText?.trim() || 'Unknown';

    items.push({
      name,
      wikiUrl,
      rarity,
      chatcode,
      guaranteed: false, // optionally enhanced later
      collectible: false,
      achievementLinked: false,
      tp: getTpUrlFromWiki(name)
    });
  }

  return items;
}

// Get TP url from item name
function getTpUrlFromWiki(name) {
  // Normally, you link name-to-ID via a third-party API or data map
  return `https://gw2trader.gg/search?q=${encodeURIComponent(name)}`;
}

// ----------------------------------
// Main logic
// ----------------------------------

// Get all playable maps
export async function fetchAllMaps() {
  const ids = await (await fetch(MAPS_API)).json();
  const playableChunks = [];
  for (let i = 0; i < ids.length; i += 100) {
    playableChunks.push(ids.slice(i, i + 100));
  }

  let allMaps = [];
  for (const chunk of playableChunks) {
    const res = await fetch(`${MAPS_API}?ids=${chunk.join(',')}`);
    const maps = await res.json();
    allMaps.push(...maps.filter(m => m.type === 'Public'));
    await wait(200); // avoid flooding API
  }

  return allMaps;
}

// Get all events
export async function fetchAllEvents() {
  const res = await fetch(EVENT_API);
  const data = await res.json();
  return Object.entries(data.events).map(([id, e]) => ({ id, ...e }));
}

// Fetch loot by scraping the wiki page (deep expansion)
export async function fetchLootForEvent(eventName) {
  try {
    const formatted = eventName.replace(/\s/g, '_');
    const wikiUrl = `${WIKI_BASE}${formatted}`;
    const html = await (await fetch(wikiUrl)).text();

    // Try to find a table under "Reward" or "Loot" section
    if (!html.includes('<table class="wikitable')) {
      console.warn('No loot table found on:', eventName);
      return [];
    }

    return parseLootTable(html);
  } catch (err) {
    console.warn('Loot parse err for', eventName, err);
    return [];
  }
}

// Generate full grouped event + loot data
export async function generateEnrichedEventData() {
  const maps = await fetchAllMaps();
  const events = await fetchAllEvents();

  const mapById = Object.fromEntries(maps.map(m => [m.id, m]));
  const outputByExpansion = {};

  for (const event of events) {
    const map = mapById[event.map_id];
    if (!map) continue;

    const loot = await fetchLootForEvent(event.name);
    if (!loot.length) continue; // skip if no useful loot

    const expansion = map.continent_name || "Core";
    const region = map.region_name || "Unknown";

    const enriched = {
      id: event.id,
      name: event.name,
      level: event.level,
      map: map.name,
      region,
      expansion,
      waypoint: getChatCode({ x: map.min_x || 0, y: map.min_y || 0 }),
      loot: loot
    };

    if (!outputByExpansion[expansion]) outputByExpansion[expansion] = [];
    outputByExpansion[expansion].push(enriched);
    await wait(100); // delay per-event wiki scan
  }

  return outputByExpansion;
}
