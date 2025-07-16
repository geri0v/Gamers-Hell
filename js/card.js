// card.js
import { renderLootCards } from './loot.js';
import { createCopyBar } from './copy.js';
import { exportEventAsJSON, exportEventAsCSV } from './export.js';

export function renderEventGroups(groups) {
  const wrapper = document.createElement('div');
  groups.forEach(({ map, items }) => {
    const section = document.createElement('section');
    section.className = 'event-group';

    const h2 = document.createElement('h2');
    h2.textContent = map;
    section.appendChild(h2);

    items.forEach(event => {
      const card = renderEventCard(event);
      section.appendChild(card);
    });

    wrapper.appendChild(section);
  });

  return wrapper;
}

export function renderEventCard(event) {
  const card = document.createElement('article');
  card.className = 'event-card';

  // --- Event Info
  const info = document.createElement('div');
  info.className = 'event-info-bar';
  info.innerHTML = `
    <strong>${event.name}</strong> 
    <span>| Map: ${event.map}</span> 
    <span>| Expansion: ${event.expansion}</span> 
    <span>| Level: ${event.level || 'Unknown'}</span> 
    <span>| Region: ${event.region || 'Unknown'}</span>
    <code>${event.waypoint || ''}</code>
  `;
  card.appendChild(info);

  // --- Copy Bar
  const copyRow = document.createElement('div');
  copyRow.innerHTML = createCopyBar(event);
  card.appendChild(copyRow);

  // --- Export Buttons (JSON & CSV)
  const exportBar = document.createElement('div');
  exportBar.className = 'export-bar';

  const jsonBtn = document.createElement('button');
  jsonBtn.className = 'export-btn';
  jsonBtn.textContent = '📄 Export JSON';
  jsonBtn.onclick = () => exportEventAsJSON(event);

  const csvBtn = document.createElement('button');
  csvBtn.className = 'export-btn';
  csvBtn.textContent = '📤 Export CSV';
  csvBtn.onclick = () => exportEventAsCSV(event);

  exportBar.appendChild(jsonBtn);
  exportBar.appendChild(csvBtn);
  card.appendChild(exportBar);

  // --- Loot Cards (actual deep-dive drops only)
  if (event.loot?.length) {
    const loot = renderLootCards(event.loot);
    card.appendChild(loot);
  } else {
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = 'No loot data available.';
    card.appendChild(empty);
  }

  return card;
}
