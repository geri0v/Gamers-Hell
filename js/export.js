// export.js

// === Export JSON ===
export function exportEventAsJSON(event) {
  const data = {
    name: event.name,
    map: event.map,
    code: event.code,
    expansion: event.expansion,
    source: event.sourcename,
    loot: (event.loot || [])
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${sanitize(event.name)}.json`);
}

// === Export CSV ===
export function exportEventAsCSV(event) {
  const loot = event.loot || [];
  if (!loot.length) return;

  const headers = ['Name', 'Rarity', 'Price (copper)', 'Vendor Value', 'Type', 'Guaranteed', 'Account Bound', 'Chat Code'];
  const rows = loot.map(item => [
    quote(item.name),
    item.rarity || '',
    item.price || '',
    item.vendorValue || '',
    item.type || '',
    item.guaranteed ? 'Yes' : '',
    item.accountBound ? 'Yes' : '',
    quote(item.chatCode || '')
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${sanitize(event.name)}.csv`);
}

// === Trigger File Download ===
function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// === Simple Sanitizer for filenames ===
function sanitize(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/\W/g, '');
}

// === CSV Escaping ===
function quote(value = '') {
  return `"${String(value).replace(/"/g, '""')}"`;
}
