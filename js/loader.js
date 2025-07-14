// loader.js

// Utility: Fetch JSON with error handling
async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Fetch item details from GW2 API
async function fetchItemDetails(itemId) {
  return await fetchJson(`https://api.guildwars2.com/v2/items/${itemId}`);
}

// Fetch price from GW2 API
async function fetchItemPrice(itemId) {
  const data = await fetchJson(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
  return data && data.sells ? data.sells.unit_price : null;
}

// Generate a GW2Wiki link for any name
function generateWikiLink(name) {
  if (!name) return null;
  const baseUrl = 'https://wiki.guildwars2.com/wiki/';
  const encoded = encodeURIComponent(name.replace(/ /g, '_'));
  return `${baseUrl}${encoded}`;
}

// Format price from copper to gold/silver/copper
function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  return `${gold}g ${silver}s ${copperRemainder}c`;
}

// Main enrichment function
export async function enrichData(data) {
  for (const event of data) {
    event.wikiLink = generateWikiLink(event.name);
    event.mapWikiLink = generateWikiLink(event.map);

    if (Array.isArray(event.loot)) {
      for (const item of event.loot) {
        if (item.id) {
          const details = await fetchItemDetails(item.id);
          if (details) {
            item.icon = details.icon;
            item.wikiLink = generateWikiLink(details.name);
            item.accountBound = details.flags ? details.flags.includes('AccountBound') : false;
            item.chatCode = details.chat_link || null;
            item.price = await fetchItemPrice(item.id);
          }
        } else {
          item.wikiLink = generateWikiLink(item.name);
        }
        item.guaranteed = !!item.guaranteed;
      }
    }
  }
  return data;
}

export { formatPrice };
