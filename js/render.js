import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

function createLootList(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  const ul = document.createElement('ul');
  loot.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name || JSON.stringify(item);
    ul.appendChild(li);
  });
  return ul;
}

function createEventItem(event) {
  const div = document.createElement('div');
  div.style.marginLeft = '2em';

  const eventName = document.createElement('div');
  eventName.textContent = event.name || 'Unnamed Event';
  eventName.style.fontWeight = 'bold';
  div.appendChild(eventName);

  const copyBar = document.createElement('div');
  copyBar.textContent = '(Copy-paste bar here)';
  copyBar.style.fontFamily = 'monospace';
  copyBar.style.background = '#f0f0f0';
  copyBar.style.padding = '0.25em 0.5em';
  copyBar.style.margin = '0.25em 0 0.25em 0';
  copyBar.style.borderRadius = '4px';
  div.appendChild(copyBar);

  const lootList = createLootList(event.loot);
  if (lootList) {
    lootList.style.marginLeft = '2em';
    div.appendChild(lootList);
  }
  return div;
}

function createSourceSection(source) {
  const container = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = source.sourceName;
  container.appendChild(h3);

  source.events.forEach(event => {
    container.appendChild(createEventItem(event));
  });
  return container;
}

function createExpansionSection(expansion) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = expansion.expansion;
  section.appendChild(h2);

  expansion.sources.forEach(source => {
    section.appendChild(createSourceSection(source));
  });

  return section;
}

async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const data = await loadAllData();
    app.innerHTML = '';

    // If your data is an array of expansions:
    data.forEach(expansion => {
      app.appendChild(createExpansionSection(expansion));
    });
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
    console.error("Error in displayData:", error);
  }
}

window.addEventListener('DOMContentLoaded', displayData);
