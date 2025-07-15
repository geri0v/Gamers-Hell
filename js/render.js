import { fetchAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData } from 'https://geri0v.github.io/Gamers-Hell/js/dataEnrich.js';
import { getCurrentLang, setCurrentLang } from 'https://geri0v.github.io/Gamers-Hell/js/lang.js';
import { renderSearchBar } from 'https://geri0v.github.io/Gamers-Hell/js/searchBar.js';
import { renderEventTables } from 'https://geri0v.github.io/Gamers-Hell/js/eventTable.js';
import { bindHandlers } from 'https://geri0v.github.io/Gamers-Hell/js/handlers.js';
import { showModals } from 'https://geri0v.github.io/Gamers-Hell/js/modals.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';

let data = [];
const lang = getCurrentLang();
const APP_CONTAINER_ID = 'app';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById(APP_CONTAINER_ID);
  container.innerHTML = '<div class="loader">Loading data...</div>';

  try {
    const raw = await fetchAllData();
    const enriched = await enrichData(raw, null, lang);
    data = enriched;

    container.innerHTML = renderSearchBar();
    const list = document.createElement('div');
    list.id = 'events-list';
    container.appendChild(list);

    await renderEventTables(data, list);
    bindHandlers(data);
    setupToggles();
    showModals(lang);
  } catch (err) {
    container.innerHTML = `<p>Error loading data: ${err.message}</p>`;
  }
});
