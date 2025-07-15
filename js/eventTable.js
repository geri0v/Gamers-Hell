import { createCopyBar } from 'https://geri0v.github.io/Gamers-Hell/js/copyBar.js';
import { createCard } from 'https://geri0v.github.io/Gamers-Hell/js/components.js';
import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/utils.js';

export async function renderEventTables(data, container) {
  // group by expansion
  const expansions = [...new Set(data.map(ev => ev.expansion))];
  container.innerHTML = '';
  for (const exp of expansions) {
    const expansionEvents = data.filter(ev => ev.expansion === exp);
    const expDiv = createCard('expansion-card', `
      <button class="toggle-btn" data-target="ex-${exp}">Show/Hide</button>
      <h2>${exp}</h2>
      <div class="expansion-content" id="ex-${exp}"></div>
    `);
    container.appendChild(expDiv);
    const content = expDiv.querySelector('.expansion-content');
    renderEventsBySource(expansionEvents, content);
  }
}

function renderEventsBySource(events, container) {
  const sources = [...new Set(events.map(ev => ev.sourcename))];
  for (const src of sources) {
    const srcEvents = events.filter(ev => ev.sourcename === src);
    const srcDiv = createCard('source-card', `
      <button class="toggle-btn" data-target="src-${src}">Show/Hide</button>
      <h3>${src}</h3>
      <div class="source-content" id="src-${src}">
        ${renderEventTableHTML(srcEvents)}
      </div>
    `);
    container.appendChild(srcDiv);
  }
}

function renderEventTableHTML(events) {
  return `
    <table class="event-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Map</th>
          <th>Code</th>
        </tr>
      </thead>
      <tbody>
        ${events.map(ev => {
          let codeInfo = ev.code || "";
          if (ev.waypointName && ev.waypointWikiLink)
            codeInfo = `<a href="${ev.waypointWikiLink}" target="_blank">${ev.waypointName}</a> ${ev.code}`;
          return `
            <tr>
              <td>${ev.wikiLink ? `<a href="${ev.wikiLink}" target="_blank">${ev.name}</a>` : ev.name}</td>
              <td>${ev.mapWikiLink ? `<a href="${ev.mapWikiLink}" target="_blank">${ev.map}</a>` : ev.map}</td>
              <td>${codeInfo}</td>
            </tr>
            <tr>
              <td colspan="3">${createCopyBar(ev)}</td>
            </tr>
            <tr>
              <td colspan="3">${renderLootCards(ev.loot)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderLootCards(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  return `
    <div class="subcards">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price !== undefined && l.price !== null ? `<div>Price: ${formatPrice(l.price)}</div>` : ''}
          ${l.vendorValue !== undefined && l.vendorValue !== null ? `<div>Vendor: ${formatPrice(l.vendorValue)}</div>` : ''}
          ${l.accountBound !== undefined ? `<div>Accountbound: ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div class="guaranteed-badge">Guaranteed</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
