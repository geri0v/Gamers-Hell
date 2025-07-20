// info.js — Alleen enrichment voor JOUW bestaande loot, BULK POST via GW2Treasures, fallback GW2 API

export const GW2T_API = "https://api.gw2treasures.com/items";
export const GW2T_KEY = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
export const GW2_API = "https://api.guildwars2.com/v2";

export function getWikiLink(label) {
  if (!label) return null;
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(label.replace(/ /g, '_'))}`;
}
export function getTPLink(name) {
  if (!name) return null;
  return `https://gw2trader.gg/search?q=${encodeURIComponent(name)}`;
}
export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return (a || b).length;
  let prev = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 0; i < a.length; ++i) {
    let curr = [i + 1];
    for (let j = 0; j < b.length; ++j)
      curr.push(Math.min(
        prev[j + 1] + 1,
        curr[j] + 1,
        prev[j] + (a[i] === b[j] ? 0 : 1)
      ));
    prev = curr;
  }
  return prev[b.length];
}
function fuzzy99(a, b) {
  a = (a || '').toLowerCase();
  b = (b || '').toLowerCase();
  const l = Math.max(a.length, b.length);
  if (l === 0) return true;
  const d = levenshtein(a, b);
  if (l <= 3) return d === 0;
  if (l < 8)  return d <= 1;
  return d / l <= 0.12;
}

/**
 * Enrich enkel loot uit JOUW EIGEN data met bulk POST Treasures + fallback GW2 API.
 */
export async function fastEnrichEvents(events) {
  // 1. Verzamel alleen unieke, geldige loot-IDs uit jouw loot
  const lootIds = [...new Set(
    events.flatMap(ev => (ev.loot||[]).map(l => l.id).filter(Boolean))
  )];

  let treasuresItems = [];
  if (lootIds.length > 0) {
    const treasuresResp = await fetch(GW2T_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GW2T_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(lootIds)
    });
    treasuresItems = treasuresResp.ok ? await treasuresResp.json() : [];
  }
  const idToGW2T = new Map(treasuresItems.map(it => [it.id, it]));

  // 2. IDs die niet enriched zijn in treasures alsnog ophalen via GW2 API
  const missingIds = lootIds.filter(id => !idToGW2T.has(id));
  let apiItems = [];
  if (missingIds.length > 0) {
    for (let i = 0; i < missingIds.length; i += 200) {
      const batchIds = missingIds.slice(i, i+200);
      const batchResp = await fetch(`${GW2_API}/items?ids=${batchIds.join(',')}`);
      const batch = batchResp.ok ? await batchResp.json() : [];
      apiItems.push(...batch);
    }
  }
  const idToApi = new Map(apiItems.map(it => [it.id, it]));
  const allItems = [...treasuresItems, ...apiItems];

  // 3. Enrichment van event/meta (altijd, niet loot-afhankelijk)
  for (const ev of events) {
    ev.wikiLink = getWikiLink(ev.name);
    if (ev.expansion)       ev.expansionWikiLink = getWikiLink(ev.expansion);
    if (ev.map)             ev.mapWikiLink = getWikiLink(ev.map);
    if (ev.location)        ev.locationWikiLink = getWikiLink(ev.location);
    if (ev.area)            ev.areaWikiLink = getWikiLink(ev.area);
    if (ev.sourcename)      ev.sourcenameWikiLink = getWikiLink(ev.sourcename);
    if (ev.closestWaypoint) ev.closestWaypointWikiLink = getWikiLink(ev.closestWaypoint);

    // 4. Enrichment van loot: alleen data die in jouw sheet/csv/json voorkomt
    ev.loot = (ev.loot||[]).map(l => {
      let item = (l.id && idToGW2T.get(l.id)) || (l.id && idToApi.get(l.id));
      if (!item && l.name) {
        item = allItems.find(it => fuzzy99(it.name, l.name));
      }
      if (!item) return null; // Geen match = verwijderen uit loot.
      return {
        ...l,
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        icon: item.icon,
        vendorValue: item.vendor_value ?? null,
        wikiLink: getWikiLink(item.name),
        tpLink: getTPLink(item.name),
        accountBound: item.flags?.includes("AccountBound") || false,
        collectible: item.collectible || false,
        achievementLinked: item.achievementLinked || false,
        guaranteed: l.guaranteed === true || l.guaranteed === "Yes"
      }
    }).filter(Boolean);
  }
  return events;
}
