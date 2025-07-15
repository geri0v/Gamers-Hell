// https://geri0v.github.io/Gamers-Hell/js/loader.js

const itemCache = {};
const priceCache = {};
const wikiCache = {};
let otcPrices = null;
let waypointCache = {};

// ... other fetch* and price logic unchanged ...

function generateWikiLink(name) {
  if (!name) return null;
  if (wikiCache[name]) return wikiCache[name];
  const baseUrl = 'https://wiki.guildwars2.com/wiki/';
  const encoded = encodeURIComponent((name || "").replace(/ /g, '_'));
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

// find the first chatcode in data for each event; show it in info bar with wiki link if possible
function waypointChatcodesInEvents(eventArr) {
  const codes = new Set();
  for (const event of eventArr) {
    if (event.code && typeof event.code === "string" && event.code.trim().length > 5) {
      codes.add(event.code.trim());
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

export async function enrichData(events, onProgress) {
  const chatcodes = waypointChatcodesInEvents(events);
  await fetchWaypointsByChatcodes(chatcodes);

  // ...rest of item/loot/price enrichment unchanged...

  for (const event of events) {
    event.wikiLink = generateWikiLink(event.name);
    event.mapWikiLink = generateWikiLink(event.map);

    // 💡 Fix: always prefer "chatcode" key if present in event object
    let codeRaw = event.chatcode || event.code || "";
    if (waypointCache[codeRaw]) {
      event.waypointName = waypointCache[codeRaw].name;
      event.waypointWikiLink = waypointCache[codeRaw].wiki;
      event.code = codeRaw;
    } else {
      event.waypointName = null;
      event.waypointWikiLink = null;
      event.code = codeRaw;
    }
    // ...blah-blah rest unchanged...
    if (onProgress) onProgress(event);
  }
  return events;
}
