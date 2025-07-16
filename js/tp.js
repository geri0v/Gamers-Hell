// tp.js

/**
 * Returns the TP URL for a given item ID using the preferred site.
 * Default = gw2trader.gg; fallback = gw2tp
 */
export function getTpUrl(itemId, site = 'gw2trader') {
  if (!itemId) return '';
  const cleaned = String(itemId).replace(/\D/g, ''); // Only digits
  if (!cleaned) return '';

  switch (site) {
    case 'gw2tp':
      return `https://www.gw2tp.com/item/${cleaned}`;
    case 'gw2trader':
    default:
      return `https://gw2trader.gg/item/${cleaned}`;
  }
}

/**
 * Returns a full <a> element (as string) to be inserted into loot/card view
 */
export function getTpAnchor(itemId, site = 'gw2trader', label = '[TP]') {
  const url = getTpUrl(itemId, site);
  if (!url) return '';
  return `<a href="${url}" class="tp-link" target="_blank" rel="noopener noreferrer" title="Check item prices on External TP">${label}</a>`;
}
