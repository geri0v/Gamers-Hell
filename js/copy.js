// copy.js

import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';

// Find the most valuable drop (by price, fallback to rarity)
function getMostValuableDrop(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  let maxItem = null;
  for (const item of loot) {
    if (item.price && (!maxItem || item.price > maxItem.price)) maxItem = item;
  }
  if (maxItem) return maxItem;
  // Fallback: pick the first Exotic or highest rarity
  const rarityOrder = ['Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  return loot.slice().sort((a, b) => rarityOrder.indexOf(a.rarity || 'Basic') - rarityOrder.indexOf(b.rarity || 'Basic'))[0];
}

export function createCopyBar(event) {
  const guaranteed = (event.loot || []).filter(l => l.guaranteed);
  const guaranteedNames = guaranteed.map(l =>
    `${l.name}${l.price ? ` (${formatPrice(l.price)})` : ''}${l.accountBound ? ' (Accountbound)' : ''}`
  ).join(', ') || 'None';

  const chance = (event.loot || []).filter(l => !l.guaranteed);
  const mostVal = getMostValuableDrop(chance);
  const chanceString = mostVal
    ? `${mostVal.name}${mostVal.price ? ` (${formatPrice(mostVal.price)})` : ''}${mostVal.accountBound ? ' (Accountbound)' : ''}`
    : 'N/A';

  const text = `${event.name} | ${event.map} | WP: ${event.code} | Guaranteed drops: ${guaranteedNames} | Chance of: ${chanceString}`;
  return `
    <div class="copy-bar">
      <input type="text" class="copy-input" value="${text.replace(/"/g, '&quot;')}" readonly>
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">Copy</button>
    </div>
  `;
}
