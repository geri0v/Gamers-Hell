// card.js
import { getChatCode } from './event.js';
import { renderLootCards } from './loot.js';
import { createCopyBar } from './copy.js';

export function renderEventCard(event) {
  const card = document.createElement('article');
  card.className = 'event-card';

  const infoBar = document.createElement('div');
  infoBar.className = 'event-info-bar';
  infoBar.innerHTML = `
    <span><strong>Name:</strong> <a href="${event.wikiLink}" target="_blank">${event.name}</a></span> |
    <span><strong>Map:</strong> <a href="${event.mapWikiLink}" target="_blank">${event.map}</a></span> |
    <span><strong>Waypoint:</strong> <a href="${event.waypointWikiLink}" target="_blank">${event.waypointName || '??'}</a>
    <code>${getChatCode(event)}</code></span>
  `;
  card.appendChild(infoBar);

  if (event.description) {
    const desc = document.createElement('p');
    desc.className = 'event-desc';
    desc.innerHTML = shortenDescription(event.description, event.wikiLink);
    card.appendChild(desc);
  }

  card.insertAdjacentHTML('beforeend', createCopyBar(event));

  if (event.loot?.length > 0) {
    const lootCards = renderLootCards(event.loot);
    card.appendChild(lootCards);
  }

  return card;
}

function shortenDescription(text, wikiLink) {
  const match = text?.match(/[^.!?]+[.!?]+/g) || [];
  let shortDesc = match.slice(0, 2).join(' ');
  if (wikiLink) {
    shortDesc += ` <a href="${wikiLink}" target="_blank">(see wiki)</a>`;
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
