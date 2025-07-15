import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/utils.js';

export function getMostValuableDrop(loot = []) {
  const chanceLoot = loot.filter(l => !l.guaranteed);
  let maxItem = chanceLoot.reduce((prev, curr) =>
    (!prev || (curr.price || 0) > (prev.price || 0)) ? curr : prev, null
  );

  if (maxItem) return maxItem;

  const rarityOrder = ['Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  return chanceLoot.sort((a, b) =>
    rarityOrder.indexOf(a.rarity || 'Basic') - rarityOrder.indexOf(b.rarity || 'Basic')
  )[0] || null;
}

export function createCopyBar(event) {
  const guaranteed = (event.loot || []).filter(l => l.guaranteed);
  const guaranteedStr = guaranteed.map(l =>
    `${l.name}${l.price ? ` (${formatPrice(l.price)})` : ''}`
  ).join(', ') || 'None';

  const mostVal = getMostValuableDrop(event.loot);
  const chanceStr = mostVal
    ? `${mostVal.name}${mostVal.price ? ` (${formatPrice(mostVal.price)})` : ''}`
    : 'N/A';

  let txt = `${event.name} | ${event.map} | WP: ${event.code} | Guaranteed drops: ${guaranteedStr} | Chance of: ${chanceStr}`;
  if (txt.length > 198) txt = txt.slice(0, 195) + '...';

  return `
    <div class="copy-bar">
      <input type="text" class="copy-input" value="${txt}" readonly />
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${txt}').then(btn => { this.innerText = 'Copied!'; setTimeout(() => this.innerText = 'Copy', 1000); })">Copy</button>
    </div>`;
}
