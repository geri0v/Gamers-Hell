// copy.js
import { formatPrice } from './info.js';

/**
 * Gets the most valuable item by price, or best rarity if no pricing exists
 */
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

/**
 * Clipboard logic with visual nudge: "Copied!" after copy
 */
export function copyWithNudge(button) {
  const input = button.previousElementSibling;
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    const original = button.textContent;
    button.textContent = 'Copied!';
    button.setAttribute('aria-live', 'polite');
    setTimeout(() => {
      button.textContent = original;
      button.removeAttribute('aria-live');
    }, 1000);
  }).catch(() => {
    button.textContent = 'Failed';
  });
}

/**
 * Copy bar component per event: shows a shortcut and copy button
 */
export function createCopyBar(event) {
  const guaranteed = (event.loot || []).filter(l => l.guaranteed);
  const guaranteedText = guaranteed.map(l =>
    `${l.name}${l.price ? ` (${formatPrice(l.price)})` : ''}${l.vendorValue ? ` (Vendor: ${formatPrice(l.vendorValue)})` : ''}${l.accountBound ? ' (Accountbound)' : ''}`
  ).join(', ') || 'None';

  const chance = (event.loot || []).filter(l => !l.guaranteed);
  const mostVal = getMostValuableDrop(chance);
  const chanceString = mostVal
    ? `${mostVal.name}${mostVal.price ? ` (${formatPrice(mostVal.price)})` : ''}${mostVal.vendorValue ? ` (Vendor: ${formatPrice(mostVal.vendorValue)})` : ''}${mostVal.accountBound ? ' (Accountbound)' : ''}`
    : 'N/A';

  let text = `${event.name} | ${event.map} | WP: ${event.code} | Guaranteed: ${guaranteedText} | Chance of: ${chanceString}`;
  
  if (text.length > 198) {
    text = text.slice(0, 195) + '...';
  }

  return `
    <div class="copy-bar" role="group" aria-label="Copy event summary">
      <input type="text" class="copy-input" value="${text.replace(/"/g, '&quot;')}" readonly aria-readonly="true" />
      <button class="copy-btn" onclick="copyWithNudge(this)" aria-label="Copy event summary to clipboard">Copy</button>
    </div>
  `;
}

/**
 * Displays 💰 icon if most valuable item in loot drop
 */
export function createMostValuableBadge(item) {
  if (!item) return '';
  return `<span class="most-valuable-badge" title="Most valuable drop for this event">💰</span>`;
}
