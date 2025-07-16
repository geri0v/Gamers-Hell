// card.js
import { renderLootCards } from './loot.js';
import { getChatCode } from './event.js';
import { createCopyBar } from './copy.js';
import { exportEventAsJSON, exportEventAsCSV } from './export.js';

export function renderEventCard(event) {
  const card = document.createElement('article');
  card.className = 'event-card';

  /* -- Top Info Bar: Name | Map | Waypoint | Code -- */
  const infoBar = document.createElement('div');
  infoBar.className = 'event-info-bar';
  infoBar.innerHTML = `
    <span>
      <strong>Name:</strong> 
      <a href="${event.wikiLink}" target="_blank" rel="noopener">${event.name}</a>
    </span> |
    <span>
      <strong>Map:</strong> 
      <a href="${event.mapWikiLink}" target="_blank" rel="noopener">${event.map}</a>
    </span> |
    <span>
      <strong>Waypoint:</strong> 
      <a href="${event.waypointWikiLink}" target="_blank" rel="noopener">${event.waypointName || '???'}</a>
      <code>${getChatCode(event)}</code>
    </span>
  `;
  card.appendChild(infoBar);

  /* -- Description with wiki link -- */
  if (event.description) {
    const desc = document.createElement('p');
    desc.className = 'event-desc';
    desc.innerHTML = shortenDescription(event.description, event.wikiLink);
    card.appendChild(desc);
  }

  /* -- Copy Bar -- */
  card.insertAdjacentHTML('beforeend', createCopyBar(event));

  /* -- Export Buttons: JSON / CSV */
  const exportBar = document.createElement('div');
  exportBar.className = 'export-bar';

  const jsonBtn = document.createElement('button');
  jsonBtn.textContent = '🔽 Export JSON';
  jsonBtn.className = 'export-btn';
  jsonBtn.onclick = () => exportEventAsJSON(event);

  const csvBtn = document.createElement('button');
  csvBtn.textContent = '📄 Export CSV';
  csvBtn.className = 'export-btn';
  csvBtn.onclick = () => exportEventAsCSV(event);

  exportBar.appendChild(jsonBtn);
  exportBar.appendChild(csvBtn);

  card.appendChild(exportBar);

  /* -- Loot Cards -- */
  if (event.loot && event.loot.length) {
    const lootCards = renderLootCards(event.loot);
    card.appendChild(lootCards);
  }

  return card;
}

function shortenDescription(text, wikiUrl) {
  const match = text?.match(/[^.!?]+[.!?]+/g) || [];
  let shortDesc = match.slice(0, 2).join(' ');
  if (wikiUrl) {
    shortDesc += ` <a href="${wikiUrl}" target="_blank">(see wiki)</a>`;
  }
  return shortDesc;
}

export function renderEventGroups(groups) {
  const container = document.createElement('div');

  groups.forEach(({ expansion, sources }) => {
    const expSection = document.createElement('section');
    expSection.className = 'expansion-group';
    expSection.dataset.expansion = expansion;

    const h2 = document.createElement('h2');
    h2.textContent = expansion;
    expSection.appendChild(h2);

    sources.forEach(({ sourcename, items }) => {
      const h3 = document.createElement('h3');
      h3.textContent = sourcename;
      expSection.appendChild(h3);

      items.forEach(event => {
        const card = renderEventCard(event);
        expSection.appendChild(card);
      });
    });

    container.appendChild(expSection);
  });

  return container;
}
