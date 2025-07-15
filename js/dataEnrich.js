import { itemCache, priceCache, waypointCache } from "https://geri0v.github.io/Gamers-Hell/js/cache.js";
import { formatPrice } from "https://geri0v.github.io/Gamers-Hell/js/utils.js";
import { generateWikiLink } from "https://geri0v.github.io/Gamers-Hell/js/wiki.js";

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchItemDetails(itemId) {
  if (itemCache[itemId]) return itemCache[itemId];
  const data = await fetchJson(`https://api.guildwars2.com/v2/items/${itemId}`);
  if (data) itemCache[itemId] = data;
  return data;
}

async function fetchItemPrice(itemId) {
  if (priceCache[itemId]) return priceCache[itemId];
  const data = await fetchJson(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
  if (data && data.sells) priceCache[itemId] = data.sells.unit_price;
  return priceCache[itemId] || null;
}

async function getItemPrice(itemId) {
  const price = await fetchItemPrice(itemId);
  return price;
}

// Finds waypoint name with wiki link by chatcode
async function fetchWaypointsForCodes(chatcodes) {
  // Minimal: not using cache, but could be expanded
  if (!chatcodes.length) return {};
  const mapIds = await fetchJson('https://api.guildwars2.com/v2/maps');
  if (!mapIds) return {};
  for (let id of mapIds) {
    const map = await fetchJson(`https://api.guildwars2.com/v2/maps/${id}`);
    if (!map || !map.points_of_interest) continue;
    for (const poi of Object.values(map.points_of_interest)) {
      if (poi.type === "waypoint" && poi.chat_link && chatcodes.includes(poi.chat_link)) {
        waypointCache[poi.chat_link] = {
          name: poi.name,
          wiki: generateWikiLink(poi.name)
        };
      }
    }
  }
  return waypointCache;
}

export async function enrichData(events, _, lang = "en") {
  const uniqueItemIds = new Set();
  events.forEach(ev => {
    (ev.loot || []).forEach(item => {
      if (item.id) uniqueItemIds.add(item.id);
    });
  });

  const itemDetails = await Promise.all([...uniqueItemIds].map(id => fetchItemDetails(id)));
  const priceDetails = await Promise.all([...uniqueItemIds].map(id => getItemPrice(id)));

  const detailsMap = {};
  [...uniqueItemIds].forEach((id, i) => {
    detailsMap[id] = itemDetails[i] || {};
    if (priceDetails[i] != null) detailsMap[id].price = priceDetails[i];
  });

  // Waypoint enrichment
  const chatcodes = events.map(e => e.code).filter(x => typeof x === "string" && x.length >= 8);
  await fetchWaypointsForCodes(chatcodes);

  for (const event of events) {
    event.wikiLink = generateWikiLink(event.name, lang);
    event.mapWikiLink = generateWikiLink(event.map, lang);

    // Assign waypoint name/link if found
    if (event.code && waypointCache[event.code]) {
      event.waypointName = waypointCache[event.code].name;
      event.waypointWikiLink = waypointCache[event.code].wiki;
    } else {
      event.waypointName = null;
      event.waypointWikiLink = null;
    }

    (event.loot || []).forEach(item => {
      if (item.id && detailsMap[item.id]) {
        Object.assign(item, {
          icon: detailsMap[item.id].icon,
          wikiLink: generateWikiLink(detailsMap[item.id].name, lang),
          accountBound: detailsMap[item.id].flags ? detailsMap[item.id].flags.includes('AccountBound') : false,
          price: detailsMap[item.id].price || null,
          vendorValue: detailsMap[item.id].vendor_value ? detailsMap[item.id].vendor_value : null
        });
      } else {
        item.wikiLink = generateWikiLink(item.name, lang);
      }
    });
  }
  return events;
}
