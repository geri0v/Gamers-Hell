// tp.js
/**
 * Generates a TP link from an item name by URL-encoding it
 * and linking to a trusted 3rd party site (e.g., GW2TP or GW2Trader).
 *
 * You can easily swap which TP site to use by changing the base URL.
 */

const TP_BASE_URL = "https://gw2trader.gg/search?q=";
// Alternate option: const TP_BASE_URL = "https://www.gw2tp.com/search.html?name=";

/**
 * @param {string} itemName - The name of the item to search for
 * @returns {string} - A full URL to open this item on the trading post tracker
 */
export function getTpUrl(itemName) {
  if (!itemName) return "";
  return TP_BASE_URL + encodeURIComponent(itemName.trim());
}
