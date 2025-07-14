// == Gamers-Hell: data.js (Robust Loader) ==

// List all your event JSON files here (raw.githubusercontent.com links only!)
window.DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
  // Add more raw JSON URLs as needed
];

// Utility: Normalize any supported event JSON structure into a flat event list
function normalizeEvents(json, url) {
  let events = [];
  if (Array.isArray(json) && json.length && json[0].events) {
    // [{ sourceName, events: [...] }, ...]
    json.forEach(block => {
      const sourceName = block.sourceName || 'Unknown Source';
      (block.events || []).forEach(ev => {
        ev.sourceName = sourceName;
        events.push(ev);
      });
    });
  } else if (Array.isArray(json) && json.length && json[0].name && json[0].loot) {
    // [{ name, loot, ... }, ...]
    events = json;
  } else if (Array.isArray(json.events)) {
    // { events: [...], sourceName? }
    const sourceName = json.sourceName || 'Unknown Source';
    json.events.forEach(ev => {
      ev.sourceName = sourceName;
      events.push(ev);
    });
  } else if (typeof json === 'object' && json !== null) {
    // { key: [events], ... }
    Object.values(json).forEach(val => {
      if (Array.isArray(val)) {
        val.forEach(ev => {
          ev.sourceName = json.sourceName || 'Unknown Source';
          events.push(ev);
        });
      }
    });
  } else {
    // Malformed or unsupported structure
    console.warn(`normalizeEvents: Unrecognized structure in ${url}`);
  }
  return events;
}

// Main loader: fetches all events, logs errors, and provides user feedback
window.loadAllEvents = async function() {
  const allEvents = [];
  const errors = [];
  const fetches = window.DATA_URLS.map(async (url) => {
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const events = normalizeEvents(json, url);
      if (!Array.isArray(events) || !events.length) {
        throw new Error('No events found or invalid structure');
      }
      allEvents.push(...events);
      console.log(`[data.js] Loaded ${events.length} events from: ${url}`);
    } catch (e) {
      errors.push({ url, error: e.message });
      window.showToast(`Failed to load JSON: ${url} (${e.message})`);
      console.error(`[data.js] Failed to load JSON: ${url}`, e);
    }
  });
  await Promise.all(fetches);

  if (errors.length) {
    // Optionally aggregate and show all errors in a single toast
    const msg = errors.map(e => `${e.url}: ${e.error}`).join('\n');
    window.showToast(`Some event files failed to load:\n${msg}`);
  }
  if (!allEvents.length) {
    window.showToast('No events loaded. Check your JSON URLs and file structure.');
  }
  return allEvents;
};
