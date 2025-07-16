// loot.js
import { formatCopper } from './gold.js';
import { createMostValuableBadge } from './copy.js';

export function getMostValuableItem(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  const byValue = [...loot].filter(i => i.price).sort((a, b) => b.price - a.price);
  if (byValue.length > 0) return byValue[0];
  return loot[0];
}

export function renderLootCards(lootList) {
  const lootGrid = document.createElement('div');
  lootGrid.className = 'loot-grid';

  const mostValuable = getMostValuableItem(lootList);

  lootList.forEach(item => {
    const lootCard = document.createElement('div');
    lootCard.className = 'loot-card';
    if (item === mostValuable) lootCard.classList.add('most-valuable');

    // Tooltip-enhanced rarity badge
    const raritySpan = item.rarity
      ? `<span class="loot-rarity rarity-${item.rarity.toLowerCase()}" title="Rarity: ${item.rarity}">${item.rarity}</span>`
      : '';

    lootCard.innerHTML = `
      ${item.icon ? `<img src="${item.icon}" class="loot-icon" alt="${item.name} icon" />` : ''}
      <div class="loot-info">
        <a href="${item.wikiLink}" target="_blank">${item.name}</a>
        ${raritySpan}
        <div class="loot-meta">
          <span>Price: ${formatCopper(item.price)}</span>
          ${item.vendorValue ? `<span>Vendor: ${formatCopper(item.vendorValue)}</span>` : ''}
          ${item.accountBound ? '<span class="loot-ab" title="Item is Account Bound">Accountbound</span>' : ''}
          ${item.guaranteed ? '<span class="loot-guaranteed" title="Always drops from event">Guaranteed</span>' : ''}
          ${item.chatCode ? `<code class="loot-chatcode" title="Waypoints or item chat code">${item.chatCode}</code>` : ''}
          ${item === mostValuable ? createMostValuableBadge(item) : ''}
        </div>
      </div>
    `;
    lootGrid.appendChild(lootCard);
  });

  return lootGrid;
}
