// == Gamers-Hell: CMD.js (hoofd-app) ==
(function() {
  // --- 1. Configuratie JSON bronnen ---
  const jsonSources = [
    {
      name: "Temples of Orr",
      url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json"
    },
    {
      name: "Valuable Events",
      url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json"
    }
    // Voeg meer bronnen toe indien gewenst!
  ];

  // --- 2. Globale variabelen ---
  window.allEvents = [];
  window.currentSearch = '';
  window.currentSort = 'name';

  // --- 3. Data laden ---
  async function fetchAllEvents() {
    const all = await Promise.all(jsonSources.map(async (src) => {
      try {
        const resp = await fetch(src.url);
        const json = await resp.json();
        let events = [];
        let sourceName = json.sourceName || src.name || 'Unknown Source';
        if (Array.isArray(json)) {
          events = json;
        } else if (Array.isArray(json.events)) {
          events = json.events;
        } else if (typeof json === 'object') {
          Object.values(json).forEach(val => {
            if (Array.isArray(val)) events = events.concat(val);
          });
        }
        events.forEach(ev => ev._sourceName = sourceName);
        return events;
      } catch (e) {
        return [];
      }
    }));
    return all.flat();
  }

  // --- 4. Filtering & rendering helpers ---
  function groupEvents(events) {
    const expansions = {};
    events.forEach(ev => {
      const exp = ev.expansion || 'Unknown Expansion';
      const src = ev._sourceName || 'Unknown Source';
      if (!expansions[exp]) expansions[exp] = {};
      if (!expansions[exp][src]) expansions[exp][src] = [];
      expansions[exp][src].push(ev);
    });
    return expansions;
  }

  function eventMatchesSearch(event, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    if ((event.name && event.name.toLowerCase().includes(q)) ||
        (event.map && event.map.toLowerCase().includes(q)) ||
        (event.code && event.code.toLowerCase().includes(q)) ||
        (event.notes && event.notes.toLowerCase().includes(q))) {
      return true;
    }
    if (Array.isArray(event.loot)) {
      for (const item of event.loot) {
        if ((item.name && item.name.toLowerCase().includes(q)) ||
            (item.code && item.code.toLowerCase().includes(q))) {
          return true;
        }
      }
    }
    if (Array.isArray(event.bosses)) {
      for (const boss of event.bosses) {
        if (boss && boss.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  }

  // --- 5. Render functie (voorbeeld, pas aan naar jouw eigen renderAllSections) ---
  window.renderAllSections = function(events, searchQuery, sortBy) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    let html = '';
    const filtered = events.filter(ev => eventMatchesSearch(ev, searchQuery));
    const expansions = groupEvents(filtered);
    let expIdx = 0;
    for (const [expansion, sources] of Object.entries(expansions)) {
      html += `<section><h2>${expansion}</h2>`;
      for (const [sourceName, evs] of Object.entries(sources)) {
        html += `<h3>${sourceName}</h3><ul>`;
        evs.forEach(ev => {
          html += `<li>${ev.name || 'Unnamed Event'}</li>`;
        });
        html += `</ul>`;
      }
      html += `</section>`;
      expIdx++;
    }
    mainContent.innerHTML = html || '<div style="color:#aaa;padding:2em;">Geen events gevonden.</div>';
  };

  // --- 6. Command-handler voor menu.js en command-line ---
  window.cmd_run = function(cmdString) {
    let match = cmdString.match(/^show expansion "(.+)" source "(.+)"$/i);
    if (match) {
      const [_, exp, src] = match;
      window.renderAllSections(
        window.allEvents.filter(ev => ev.expansion === exp && ev._sourceName === src),
        window.currentSearch,
        window.currentSort
      );
      return;
    }
    match = cmdString.match(/^show expansion "(.+)"$/i);
    if (match) {
      const [_, exp] = match;
      window.renderAllSections(
        window.allEvents.filter(ev => ev.expansion === exp),
        window.currentSearch,
        window.currentSort
      );
      return;
    }
    match = cmdString.match(/^show source "(.+)"$/i);
    if (match) {
      const [_, src] = match;
      window.renderAllSections(
        window.allEvents.filter(ev => ev._sourceName === src),
        window.currentSearch,
        window.currentSort
      );
      return;
    }
    match = cmdString.match(/^show all$/i);
    if (match) {
      window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
      return;
    }
    alert("Onbekend commando: " + cmdString);
  };

  // --- 7. Initialisatie ---
  (async function loadAndRenderAll() {
    window.allEvents = await fetchAllEvents();
    window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
  })();

})();
