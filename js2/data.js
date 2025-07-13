// == Gamers-Hell: data.js ==

export const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
  // Add more JSON URLs here as needed
];

// Loads and normalizes all events from all sources
export async function loadAllEvents() {
  const all = await Promise.all(DATA_URLS.map(async (url) => {
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      let events = [];
      // If the JSON is an array of events directly
      if (Array.isArray(json)) {
        // If each entry is an event, use as is
        if (json.length && json[0].name && json[0].loot) {
          events = json;
        } else {
          // If each entry is a block with sourceName and events, flatten
          json.forEach(block => {
            const sourceName = block.sourceName || 'Unknown Source';
            (block.events || []).forEach(ev => {
              ev.sourceName = sourceName;
              events.push(ev);
            });
          });
        }
      } else if (Array.isArray(json.events)) {
        // If JSON has a top-level "events" array
        const sourceName = json.sourceName || 'Unknown Source';
        json.events.forEach(ev => {
          ev.sourceName = sourceName;
          events.push(ev);
        });
      } else if (typeof json === 'object') {
        // If JSON is an object with multiple arrays (legacy format)
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
      return [];
    }
  }));
  return all.flat();
}
