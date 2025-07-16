// event.js
export function getChatCode(event) {
  return event.code || event.chatcode || '';
}

export function groupByExpansionAndSource(events) {
  const grouped = {};
  events.forEach(item => {
    const exp = item.expansion || 'Unknown';
    const src = item.sourcename || 'Unknown';
    if (!grouped[exp]) grouped[exp] = {};
    if (!grouped[exp][src]) grouped[exp][src] = [];
    grouped[exp][src].push(item);
  });

  return Object.entries(grouped).sort().map(([expansion, sources]) => ({
    expansion,
    sources: Object.entries(sources).sort().map(([sourcename, items]) => ({
      sourcename,
      items
    }))
  }));
}
