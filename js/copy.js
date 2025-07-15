import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';

export function getMostValuableDrop(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  let maxItem = null;
  for (const item of loot) {
    if (item.price && (!maxItem || item.price > maxItem.price)) maxItem = item;
  }
  if (maxItem) return maxItem;
  const rarityOrder = ['Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  return loot.slice().sort((a, b) =>
    rarityOrder.indexOf(a.rarity || 'Basic') - rarityOrder.indexOf(b.rarity || 'Basic')
  )[0];
}

window.copyWithNudge = function(button) {
  navigator.clipboard.writeText(button.previousElementSibling.value).then(() => {
    const original = button.textContent;
    button.textContent = 'Copied!';
    button.setAttribute('aria-live', 'polite');
    setTimeout(() => {
      button.textContent = original;
      button.removeAttribute('aria-live');
    }, 1000);
  });
};

export function createCopyBar(event) {
  const guaranteed = (event.loot || []).filter(l => l.guaranteed);
  const guaranteedNames = guaranteed.map(l =>
    `${l.name}${l.price ? ` (${formatPrice(l.price)})` : ''}${l.vendorValue ? ` (Vendor: ${formatPrice(l.vendorValue)})` : ''}${l.accountBound ? ' (Accountbound)' : ''}`
  ).join(', ') || 'None';

  const chance = (event.loot || []).filter(l => !l.guaranteed);
  const mostVal = getMostValuableDrop(chance);
  const chanceString = mostVal
    ? `${mostVal.name}${mostVal.price ? ` (${formatPrice(mostVal.price)})` : ''}${mostVal.vendorValue ? ` (Vendor: ${formatPrice(mostVal.vendorValue)})` : ''}${mostVal.accountBound ? ' (Accountbound)' : ''}`
    : 'N/A';

  let text = `${event.name} | ${event.map} | WP: ${event.code} | Guaranteed drops: ${guaranteedNames} | Chance of: ${chanceString}`;
  if (text.length > 198) {
    text = text.slice(0, 195) + '...';
  }
  
  return `
    <div class="copy-bar" role="group" aria-label="Copy event summary">
      <input type="text" class="copy-input" value="${text.replace(/"/g, '&quot;')}" readonly aria-readonly="true" />
      <button class="copy-btn" onclick="copyWithNudge(this)" aria-label="Copy event summary">Copy</button>
    </div>
  `;
}

export function createMostValuableBadge(item) {
  if (!item) return '';
  return `<span class="most-valuable-badge" title="Most valuable drop">💰</span>`;
}
