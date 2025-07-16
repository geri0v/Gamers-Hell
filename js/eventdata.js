// eventdata.js
// Fetches all events per map, finds all containers/chests per event, then unpacks all actual loot inside those containers, removing containers from the final view.
// This is designed for a browser/static JS context only (no static JSON required).

import { getTpUrl } from './tp.js';

const GW2_API = {
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
  MAPS: 'https://api.guildwars2.com/v2/maps',
};
const WIKI_BASE = 'https://wiki.guildwars2.com/wiki/';

// Helper: List of container/junk patterns to suppress
const FILTER_CONTAINERS = [
  /chest/i,
  /bag/i,
  /box/i,
  /bundle/i,
  /cache/i,
  /pouch/i,
  /sack/i,
  /pack/i,
  /reward/i,
  /supply/i,
  /^container$/i,
  /^trophy$/i,
];

// Helper: "Junk" regular expressions
function isContainerOrJunk(name) {
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

// === Parse actual loot tables from wiki page HTML ===
// Returns list of: [{name, wikiUrl, rarity, guaranteed, accountBound, collectible, achievementLinked, tp, ...}]
async function parseWikiLootTable(wikiPage) {
  const raw = await fetch(`${WIKI_BASE}${encodeURIComponent(wikiPage.replace(/\s+/g, "_"))}`).then(r => r.text());
  const doc = new DOMParser().parseFromString(raw, "text/html");
  // Try to find the Rewards or Loot table under relevant headers
  const lootTables = [...doc.querySelectorAll("table.wikitable")];
  // Find the most relevant table (often after a '== Loot ==' or '== Rewards ==' heading)
  let lootItems = [];
  for (const table of lootTables) {
    // Each row of the table
    for (const row of table.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) continue;
      const itemLink = cells[0].querySelector("a");
      if (!itemLink) continue;
      const name = itemLink.textContent.trim();
      if (isContainerOrJunk(name)) continue; // Don't show containers themselves

      // Try to get TP value (fallback: build a search url)
      const tp = getTpUrl(name);

      // Try to get rarity if in the table
      let rarity = "";
      for (const icon of cells[0].querySelectorAll("img[alt]")) {
        if (/Ascended|Exotic|Rare|Masterwork|Fine|Basic/i.test(icon.alt)) {
          rarity = icon.alt;
          break;
        }
      }
      // Or try from adjacent text
      if (!rarity && cells[1]) {
        if (/Ascended|Exotic|Rare|Masterwork|Fine|Basic/i.test(cells[1].textContent)) {
          rarity = cells[1].textContent.trim();
        }
      }
      // Determine if it's guaranteed by table labeling
      const guaranteed = /guaranteed/i.test(row.textContent);

      // Detect achievement/collectible (by tooltip/parent span) (may need refinement)
      const collectible = /mini|skin|collectible|collection/i.test(name);
      const achievementLinked = /achievement|collection|unlock/i.test(row.textContent);

      lootItems.push({
        name,
        wikiUrl: 'https://wiki.guildwars2.com' + itemLink.getAttribute('href'),
        rarity,
        guaranteed,
        accountBound: /accountbound/i.test(row.textContent),
        collectible,
        achievementLinked,
        tp,
      });
    }
  }
  return lootItems;
}

// Fetch all public maps
export async function fetchAllMaps() {
  const ids = await fetch(GW2_API.MAPS).then(res => res.json());
  const chunked = [];
  for (let i = 0; i < ids.length; i += 100) chunked.push(ids.slice(i, i + 100));
  let maps = [];
  for (const chunk of chunked) {
    const info = await fetch(`${GW2_API.MAPS}?ids=${chunk.join(",")}`).then(r => r.json());
    maps.push(...info.filter(m => m.type === "Public"));
  }
  return maps;
}

// Fetch all events
export async function fetchAllEvents() {
  const res = await fetch(GW2_API.EVENTS);
  const data = await res.json();
  return Object.entries(data.events).map(([id, e]) => ({ id, ...e }));
}

// Get detailed, deep-unpacked loot per event (may be async/slow for ALL events; for demo use per-event fetch)
export async function fetchEventLootDeep(eventNameOrWikiPage) {
  // Parse wiki event or chest page for loot. If event links to a container, recursively unpack.
  const artifacts = await parseWikiLootTable(eventNameOrWikiPage);

  // If any items in artifacts still match junk/container, try to recurse their wiki pages one level deep
  let trulyDeepLoot = [];
  for (let item of artifacts) {
    if (isContainerOrJunk(item.name)) {
      // Try to unpack this container one level deeper
      const deepItems = await parseWikiLootTable(item.name);
      trulyDeepLoot.push(...deepItems.filter(i => !isContainerOrJunk(i.name)));
    } else {
      trulyDeepLoot.push(item);
    }
  }
  return trulyDeepLoot;
}

// Generate the live, truly deep event + loot dataset
export async function generateDeepEventDataset() {
  const maps = await fetchAllMaps();
  const events = await fetchAllEvents();

  const mapById = Object.fromEntries(maps.map(m => [m.id, m]));
  const eventsByMap = {};

  for (let event of events) {
    const map = mapById[event.map_id];
    if (!map) continue;
    // Compose a nice wiki page name (by event) (may need special case handling for edge cases)
    const eventWikiPage = event.name.replace(/ /g, "_");
    let loot = [];

    // Attempt the very deep loot expansion (actual page name or via chest redirection; slow if page doesn't exist)
    try {
      loot = await fetchEventLootDeep(eventWikiPage);
    } catch (err) {
      loot = [];
    }
    if (!loot.length) continue; // skip events with no real drops

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push({
      id: event.id,
      name: event.name,
      level: event.level || null,
      map: map.name,
      region: map.region_name,
      expansion: map.continent_name,
      // Optional: Add formatted nearest waypoint/POI logic here.
      loot,
    });
  }
  return eventsByMap;
}
