import { formatPrice } from "https://geri0v.github.io/Gamers-Hell/js/utils.js";

export function getMostValuableDrop(loot = []) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  let maxItem = null;
  for (const item of loot) {
    if (item.price && (!maxItem || item.price > maxItem.price)) maxItem = item;
  }
  if (maxItem) return maxItem;
  const rarityOrder = ['Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  return loot.slice().sort((a, b) =>
    rarityOrder.indexOf(a.rarity || 'Basic') - rarityOrder.indexOf(b.rarity || 'Basic')
  )[0] || null;
}

export function createCopyBar(event) {
  const guaranteed = (event.loot || []).filter(l => l.guaranteed);
  const guaranteedNames = guaranteed.map(l =>
    `${l.name}${l.price ? ` (${formatPrice(l.price)})` : ''}${l.vendorValue ? ` (Vendor: ${formatPrice(l.vendorValue)})` : ''}${l.accountBound ? ' (Accountbound)' : ''}`
  ).join(', ') || 'None';

  const mostVal = getMostValuableDrop(event.loot);
  const chanceString = mostVal
    ? `${mostVal.name}${mostVal.price ? ` (${formatPrice(mostVal.price)})` : ''}${mostVal.vendorValue ? ` (Vendor: ${formatPrice(mostVal.vendorValue)})` : ''}${mostVal.accountBound ? ' (Accountbound)' : ''}`
    : 'N/A';

  let text = `${event.name} | ${event.map} | WP: ${event.code} | Guaranteed drops: ${guaranteedNames} | Chance of: ${chanceString}`;
  if (text.length > 198) {
    text = text.slice(0, 195) + '...';
  }
  // Clipboard
  return `
    <div class="copy-bar" role="group" aria-label="Copy event summary">
      <input type="text" class="copy-input" value="${text.replace(/"/g, '&quot;')}" readonly aria-readonly="true" />
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(()=>{const orig=this.textContent;this.textContent='Copied!';setTimeout(()=>this.textContent=orig,1000);});" aria-label="Copy event summary">Copy</button>
    </div>
  `;
}
