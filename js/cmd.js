// == Gamers-Hell: Full JS App ==
(function() {
  // --- 1. Inject Styles ---
  const style = document.createElement('style');
  style.textContent = `/* ... (styles unchanged, omitted for brevity) ... */`;
  document.head.appendChild(style);

  // --- 2. Build Page Structure ---
  document.body.innerHTML = ''; // Clear any existing content

  // Header
  const header = document.createElement('header');
  header.innerHTML = '<h1>Gamers-Hell</h1>';
  document.body.appendChild(header);

  // Main
  const main = document.createElement('main');
  main.className = 'main';
  main.setAttribute('aria-label', 'Main content area');
  main.setAttribute('id', 'main');
  main.setAttribute('role', 'main');
  main.setAttribute('tabindex', '-1');
  document.body.appendChild(main);

  // Search Bar
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar-container';
  searchBar.setAttribute('role', 'search');
  searchBar.innerHTML = `/* ... (search bar HTML unchanged) ... */`;
  main.appendChild(searchBar);

  // Main Content
  const mainContent = document.createElement('div');
  mainContent.setAttribute('aria-live', 'polite');
  mainContent.setAttribute('aria-relevant', 'additions');
  mainContent.setAttribute('id', 'mainContent');
  mainContent.setAttribute('tabindex', '0');
  mainContent.innerHTML = `<div id="allSections"></div>`;
  main.appendChild(mainContent);

  // Footer
  const footer = document.createElement('footer');
  footer.innerHTML = '© 2025 Gamers-Hell Community';
  document.body.appendChild(footer);

  // Modal
  const eventModal = document.createElement('div');
  eventModal.id = 'eventModal';
  eventModal.style.display = 'none';
  eventModal.style.position = 'fixed';
  eventModal.style.top = '0';
  eventModal.style.left = '0';
  eventModal.style.width = '100vw';
  eventModal.style.height = '100vh';
  eventModal.style.background = 'rgba(30,38,48,0.95)';
  eventModal.style.zIndex = '1000';
  eventModal.style.alignItems = 'center';
  eventModal.style.justifyContent = 'center';
  eventModal.innerHTML = `/* ... (modal HTML unchanged) ... */`;
  document.body.appendChild(eventModal);

  // --- 3. App Logic ---
  const jsonSources = [
    {
      name: "Temples of Orr",
      url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json"
    },
    {
      name: "Valuable Events",
      url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json"
    }
    // Add more sources here!
  ];

  // --- GLOBALS for menu.js ---
  let allEvents = [];
  window.allEvents = allEvents; // Make available globally

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
  window.groupEvents = groupEvents; // Make available globally

  let currentSearch = '';
  let currentSort = 'name';

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

  // ... (rest of your logic unchanged)

  // --- 6. Initial Load ---
  (async function loadAndRenderAll() {
    allEvents = await fetchAllEvents();
    window.allEvents = allEvents; // Update the global reference after fetching
    renderAllSections(allEvents, currentSearch, currentSort);
  })();

  // ... (rest of your code unchanged)
})();
