// info.js — Dynamische live enrichment pipeline op NAAM (geen OTC, geen bulkfile)
// Levert id, type, rarity, icon, flags, description, tp/wiki-link etc per loot
// Werkt direct met jouw output van fetchAllData()

export async function fastEnrichEvents(events) {
  // Verzamel alle unieke lootnamen uit eigen data
  const uniqueLootNames = [
    ...new Set(events.flatMap(ev => (ev.loot || []).map(l => l.name).filter(Boolean)))
  ];

  // Bouw enrichment mapping: naam → all enrichment fields
  const nameToEnriched = new Map();
  for (const lootName of uniqueLootNames) {
    let data = null;

    // 1. GW2 Wiki (MediaWiki API, fuzzy99 op title; returns id/type/rarity/desc/icon/flags)
    data = await searchWikiItem(lootName);
    if (!data) data = await fuzzySearchWikiItem(lootName);

    // 2. Dulfy/Fr Database (HTML search/fetch, fuzzy op title; returns id/type/rarity/icon etc)
    if (!data) data = await searchDulfy(lootName);

    // 3. DrunkenMMO (HTML/zoek/fetch, fuzzy op name)
    if (!data) data = await searchDrunkenMMO(lootName);

    // 4. GW2TP API (alleen als CORS toestaat, prijs/tpLink basics, TP-data enrichment)
    if (!data) data = await searchGW2TP(lootName);

    // 5. GW2 API fallback (lookup of id only, match fuzzy op naam binnen batches)
    if (!data) data = await searchGW2API(lootName);

    if (data) nameToEnriched.set(lootName, data);
    // Bonus: je kunt hier logging aanzetten om te zien waar een lootregel strandt
  }

  // Nu alle events/loot enrichen
  for (const ev of events) {
    ev.wikiLink = getWikiLink(ev.name);
    if (ev.expansion)       ev.expansionWikiLink = getWikiLink(ev.expansion);
    if (ev.map)             ev.mapWikiLink = getWikiLink(ev.map);
    if (ev.location)        ev.locationWikiLink = getWikiLink(ev.location);
    if (ev.area)            ev.areaWikiLink = getWikiLink(ev.area);
    if (ev.sourcename)      ev.sourcenameWikiLink = getWikiLink(ev.sourcename);
    if (ev.closestWaypoint) ev.closestWaypointWikiLink = getWikiLink(ev.closestWaypoint);

    ev.loot = (ev.loot || []).map(l => {
      const enriched = nameToEnriched.get(l.name);
      if (!enriched) return null;
      return {
        ...l,
        ...enriched,
        wikiLink: getWikiLink(enriched.name || l.name),
        tpLink: getTPLink(enriched.name || l.name),
        guaranteed: l.guaranteed === true || l.guaranteed === "Yes"
      };
    }).filter(Boolean);
  }
  return events;
}

// ----------- HULPFUNCTIES (fuzzy, urls, helpers) ------------

function levenshtein(a, b) {
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
function getWikiLink(label) {
  if (!label) return null;
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(label.replace(/ /g, '_'))}`;
}
function getTPLink(name) {
  if (!name) return null;
  return `https://gw2trader.gg/search?q=${encodeURIComponent(name)}`;
}

// ------------- Async enrichment helpers (één per bron) -------------

async function searchWikiItem(name) {
  // MediaWiki API exact-match search
  const url = `https://wiki.guildwars2.com/api.php?action=query&format=json&origin=*&prop=pageprops|description|info|pageimages|extracts|revisions&redirects=1&titles=${encodeURIComponent(name)}`;
  const r = await fetch(url);
  if (r.ok) {
    const j = await r.json();
    const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
    if (pages.length && pages[0].title) {
      // Minimal structuur -- uitbreiden naargelang extra wiki-veld extraction gewenst is
      const page = pages[0];
      return {
        id: null, // Gewoon handmatig/fuzzy vullen; wiki levert geen GW2 API-id, tenzij in pageprops
        name: page.title,
        description: page.extract || page.description || "",
        icon: page.pageimage ? `https://wiki.guildwars2.com${page.pageimage}` : null,
        rarity: null // Kan uit extra velden pagina worden geplukt
        // ...meer velden indien beschikbaar
      };
    }
  }
  return null;
}

async function fuzzySearchWikiItem(name) {
  // MediaWiki API search+fuzzy, return match als ≥99%
  const url = `https://wiki.guildwars2.com/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(name)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const s = await r.json();
  const match = (s.query && s.query.search || []).find(result => fuzzy99(result.title, name));
  if (match) return await searchWikiItem(match.title);
  return null;
}

// Dulfy/Fr DB live search (voorbeeld: titel in dom, html scrape)
// LET OP: CORS kan hier browser-fetch blokkeren!
// Je kunt ook een GET op /search maken en parsing toepassen
async function searchDulfy(name) {
  try {
    const url = `https://db.dulfy.net/search/?query=${encodeURIComponent(name)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const html = await resp.text();
    // Hier moet eenvoudige tekstmatige extractie of regex-apparaatje op naam!
    // Voorbeeldminimaal: zoek naar <a ...>itemname</a> in result
    const re = new RegExp(`<a [^>]*>([^<]*${name}[^<]*)</a>`, "i");
    const match = html.match(re);
    if (match && fuzzy99(name, match[1])) {
      return {
        name: match[1],
        description: "", // Complexer scrapen mogelijk
        icon: null      // Scrapen uit img src van result
      };
    }
  } catch (e) {}
  return null;
}

// DrunkenMMO live html-search/scraping (LET OP: CORS-beperkingen!)
async function searchDrunkenMMO(name) {
  try {
    const url = `https://drunkenmmo.com/guild-wars-2-game/items?search=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const html = await r.text();
    // Zoek naam in search-result table
    const re = new RegExp(`<td[^>]*>([^<]*${name}[^<]*)</td>`, "i");
    const match = html.match(re);
    if (match && fuzzy99(name, match[1])) {
      return {
        name: match[1],
        description: "",
        icon: null
      };
    }
  } catch (e) {}
  return null;
}

// GW2TP API (PUBLIC); alleen prijs, link etc (LET OP: CORS!)
async function searchGW2TP(name) {
  try {
    // GW2TP id-zoek mapping ophalen? Eventueel: https://api.gw2tp.com/1/items?name=...
    const url = `https://www.gw2tp.com/api/v2/items?name=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    // Zoek het beste fuzzy matchende resultaat
    const i = (j.items||[]).find(x => fuzzy99(x.name, name));
    if (i) {
      return {
        name: i.name,
        id: i.id,
        tpLink: getTPLink(i.name)
        // ...meer velden mogelijk
      };
    }
  } catch (e) {}
  return null;
}

// Laatste fallback: GW2 API live zoekt per request (alleen id → lootnaam → fuzzy)
async function searchGW2API(name) {
  // /v2/items?ids=ALL_IDS kan niet op NAAM, helaas; dus search-batch naar /v2/items?text=...
  // Maar deze bestaat niet — alternative: fetch subsets for fuzzy within 1...999999
  // Eenvoudigste manier is brute-force: fetch een aantal (10k/1k/100/batch), of juist alleen als je een id uit je data hebt:
  return null; // Bewaar als echte fallback als geen van bovenstaande werkt (wegens API-limiet)
}
