// copy.js

/**
 * Returns HTML string for copy bar with detailed loot summary.
 * Format example:
 * "Temple of Balthazar | Straits of Devastation | WP: [&BNIEAAA=] | Guaranteed: Obsidian Shard, Essence of Luck | Chance of: Balthazar's Band (98g 0s 0c) (Vendor: 0g 3s 96c)"
 * Max 198 characters, trimmed gracefully.
 *
 * @param {Object} event - Enriched event with loot array, etc.
 */
export function createCopyBar(event) {
  const waypoint = event.waypoint ? `WP: ${event.waypoint}` : '';

  const guaranteed = event.loot?.filter(i => i.guaranteed) || [];
  const chance = event.loot?.filter(i => !i.guaranteed) || [];

  // Format currency from copper
  const formatCurrency = c => {
    if (!c || isNaN(c) || c === 0) return '';
    const g = Math.floor(c / 10000);
    const s = Math.floor((c % 10000) / 100);
    const c_ = c % 100;
    return `${g > 0 ? g + 'g ' : ''}${s > 0 ? s + 's ' : ''}${c_}c`;
  };

  // Format vendor value string
  const formatVendor = v => (v ? `(Vendor: ${formatCurrency(v)})` : '');

  // Format a list of items as names only
  const formatNames = items => items.map(i => i.name).join(', ');

  // Format chance items with potential value + vendor price
  const formatChanceItems = items => items.map(i => {
    const valStr = i.value ? `(${formatCurrency(i.value)})` : '';
    const vendorStr = formatVendor(i.vendorValue);
    return `${i.name}${valStr} ${vendorStr}`.trim();
  }).join(', ');

  // Compose string components
  const parts = [
    event.name,
    event.map,
    waypoint || '',
    guaranteed.length > 0 ? `Guaranteed: ${formatNames(guaranteed)}` : '',
    chance.length > 0 ? `Chance of: ${formatChanceItems(chance)}` : ''
  ].filter(Boolean);

  let fullText = parts.join(' | ');

  // Trim to 198 characters max with ellipsis
  if (fullText.length > 198) {
    fullText = fullText.slice(0, 195) + '...';
  }

  return `
    <div class="copy-bar">
      <input class="copy-input" readonly value="${escapeHtml(fullText)}" />
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeJs(fullText)}'); this.textContent='✓ Copied!'">
        📋 Copy
      </button>
    </div>
  `;
}

// Escape for HTML attribute (input value)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape for JS string literal
function escapeJs(str) {
  return String(str).replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}
