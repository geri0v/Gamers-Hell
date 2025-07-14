// == Gamers-Hell: data.js ==

window.DATA_URLS = [
  // Use only raw.githubusercontent.com links!
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
  // Add more JSON URLs here as needed
];

window.loadAllEvents = async function() {
  const all = await Promise.all(window.DATA_URLS.map(async (url) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      let events = [];
      // Accept multiple formats
      if (Array.isArray(json) && json.length && json[0].events) {
        json.forEach(block => {
          const sourceName = block.sourceName || 'Unknown Source';
          (block.events || []).forEach(ev => {
            ev.sourceName = sourceName;
            events.push(ev);
          });
        });
      } else if (Array.isArray(json) && json.length && json[0].name && json[0].loot) {
        events = json;
      } else if (Array.isArray(json.events)) {
        const sourceName = json.sourceName || 'Unknown Source';
        json.events.forEach(ev => {
          ev.sourceName = sourceName;
          events.push(ev);
        });
      } else if (typeof json === 'object') {
        Object.values(json).forEach(val => {
          if (Array.isArray(val)) {
            val.forEach(ev => {
              ev.sourceName = json.sourceName || 'Unknown Source';
              events.push(ev);
            });
          }
        });
      }
      return events;
    } catch (e) {
      window.showToast(`Failed to load JSON: ${url} (${e.message})`);
      console.error(`Failed to load JSON: ${url}`, e);
      return [];
    }
  }));
  return all.flat();
};
