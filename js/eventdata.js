// eventdata.js
// Fetches all events per map, finds all loot-reward containers, and unpacks actual drops.
// Safe in-browser, CORS-restricted. Designed for GitHub Pages/static JS hosting.

import { getTpUrl } from './tp.js';

const GW2_API = {
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
  MAPS: 'https://api.guildwars2.com/v2/maps',
};
const WIKI_BASE = 'https://wiki.guildwars2.com/wiki/';
const WIKI_MAX_DEPTH = 1; // prevent infinite recursion

// Simple storage blacklist rules for loot containers/notable junk
const FILTER_CONTAINERS = [
  /chest/i,
  /bag/i,
  /box/i,
  /bundle/i,
  /cache/i,
  /pouch/i,
  /sack/i,
  /reward/i,
  /pack/i,
  /^container$/i,
  /^trophy$/i
];

function isContainerOrJunk(name) {
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

// === Normalize Event Name to Expected Wiki Page ===
function formatWikiPage(eventName) {
  return eventName.trim().replace(/\s+/g, '_');
}

// Parse loot tables from a wiki page by name (HTML scrape)
async function parseWikiLootTable(pageName, depth = 0) {
  const safeName = encodeURIComponent(pageName);
  const url = `${WIKI_BASE}${safeName}`;
  const lootItems = [];

  try {
    const html = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`Wiki page 404: ${pageName}`);
      return r.text();
    });

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = [...doc.querySelectorAll('table.wikitable')];

    for (const table of tables) {
      for (const row of table.querySelectorAll('tr')) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 1) continue;

        const itemLink = cells[0].querySelector('a');
        if (!itemLink) continue;

        const name = itemLink.textContent.trim();
        if (!name || isContainerOrJunk(name)) continue;

        const tp = getTpUrl(name);
        let rarity = '';

        // Get rarity from icons or adjacent text
        const icon = cells[0].querySelector('img[alt]');
        if (icon && icon.alt) rarity = icon.alt;
        else if (cells[1] && /ascended|exotic|rare|fine|basic|masterwork/i.test(cells[1].textContent))
          rarity = cells[1].textContent.trim();

        // Map achievement-linked / account-bound / collectible
        const guaranteed = /guaranteed/i.test(row.textContent);
        const accountBound = /accountbound/i.test(row.textContent);
        const collectible = /mini|skin|collectible|collection/i.test(name.toLowerCase());
        const achievementLinked = /achievement|collection|unlock/i.test(row.textContent.toLowerCase());

        lootItems.push({
          name,
          wikiUrl: 'https://wiki.guildwars2.com' + itemLink.getAttribute('href'),
          rarity,
          guaranteed,
          accountBound,
          collectible,
          achievementLinked,
          tp
        });
      }
    }

    // Optionally recurse containers
    if (depth < WIKI_MAX_DEPTH) {
      const inner = [];
      for (const item of lootItems) {
        if (isContainerOrJunk(item.name)) {
          const more = await parseWikiLootTable(formatWikiPage(item.name), depth + 1);
          inner.push(...more.filter(i => !isContainerOrJunk(i.name)));
        } else {
          inner.push(item);
        }
      }
      return inner;
    }

    return lootItems;
  } catch (err) {
    console.warn(`Error parsing wiki: ${pageName}`, err.message);
    return [];
  }
}

// === Fetch all public maps (not WvW / PvP / instances) ===
export async function fetchAllMaps() {
  const ids = await fetch(GW2_API.MAPS).then(res => res.json());
  let all = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = await fetch(`${GW2_API.MAPS}?ids=${ids.slice(i, i + 100).join(',')}`).then(r => r.json());
    all.push(...chunk);
  }
  return all.filter(m => m.type === 'Public');
}

// === Fetch all map events (flat list) ===
export async function fetchAllEvents() {
  const res = await fetch(GW2_API.EVENTS);
  const data = await res.json();
  return Object.entries(data.events).map(([id, event]) => ({ id, ...event }));
}

// === Deep loot fetch per event ===
export async function fetchEventLootDeep(eventName) {
  const formatted = formatWikiPage(eventName);
  return await parseWikiLootTable(formatted);
}

// === Output: Object[map_name] = [ enriched events ] ===
export async function generateDeepEventDataset() {
  const maps = await fetchAllMaps();
  const mapById = Object.fromEntries(maps.map(m => [m.id, m]));

  const allEvents = await fetchAllEvents();
  const eventsByMap = {};

  for (const event of allEvents) {
    const map = mapById[event.map_id];
    if (!map) continue;

    const wikiPage = formatWikiPage(event.name);
    const loot = await fetchEventLootDeep(wikiPage);
    if (!loot || !loot.length) continue;

    const enrichedEvent = {
      id: event.id,
      name: event.name,
      map: map.name,
      region: map.region_name || 'Unknown',
      expansion: map.continent_name || 'Core',
      level: event.level || null,
      waypoint: '', // optional: add later
      loot
    };

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push(enrichedEvent);
  }

  return eventsByMap;
}
