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
      let sourceName = json.sourceName || 'Unknown Source';
      if (Array.isArray(json)) {
        events = json;
      } else if (Array.isArray(json.events)) {
        events = json.events;
      } else if (typeof json === 'object') {
        Object.values(json).forEach(val => {
          if (Array.isArray(val)) events = events.concat(val);
        });
      }
      events.forEach(ev => ev.sourceName = sourceName);
      return events;
    } catch (e) {
      return [];
    }
  }));
  return all.flat();
}
