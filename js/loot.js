// loot.js
import { formatCopper } from './gold.js';

export function renderLootCards(lootList) {
  const lootGrid = document.createElement('div');
  lootGrid.className = 'loot-grid';

  lootList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'loot-card';

    const info = document.createElement('div');
    info.className = 'loot-info';

    // === Item Name + Rarity
    const title = document.createElement('div');
    title.className = 'loot-title';

    title.innerHTML = `
      <a href="${item.wikiUrl}" target="_blank" rel="noopener">
        ${item.name}
      </a> 
      ${item.tp ? `<a href="${item.tp}" class="tp-link" target="_blank" title="Trading Post">[TP]</a>` : ''}
    `;

    // === Rarity-colored Tag
    if (item.rarity) {
      const rarity = item.rarity.toLowerCase();
      title.classList.add(`rarity-${rarity}`);
    }

    info.appendChild(title);

    // === Badges Row
    const meta = document.createElement('div');
    meta.className = 'loot-meta';

    const makeBadge = (label, title, className) => {
      const span = document.createElement('span');
      span.className = className;
      span.title = title;
      span.textContent = label;
      return span;
    };

    if (item.guaranteed) {
      meta.appendChild(makeBadge('💎 Guaranteed', 'Always drops', 'loot-guaranteed'));
    }
    if (item.collectible) {
      meta.appendChild(makeBadge('📦 Collectible', 'Part of collection/skin/mini', 'loot-collectible'));
    }
    if (item.achievementLinked) {
      meta.appendChild(makeBadge('🏆 Achievement', 'Linked to achievement', 'loot-achievement'));
    }
    if (item.accountBound) {
      meta.appendChild(makeBadge('🔒 Bound', 'Account Bound', 'loot-bound'));
    }
    if (item.chatcode) {
      meta.appendChild(makeBadge(item.chatcode, 'In-game item code', 'loot-chatcode'));
    }

    info.appendChild(meta);
    card.appendChild(info);
    lootGrid.appendChild(card);
  });

  return lootGrid;
}
