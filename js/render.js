import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';
import { createCopyBar } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderLoot(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  return `
    <div class="subcards">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price !== undefined && l.price !== null ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound !== undefined ? `<div><strong>Accountbound:</strong> ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div class="guaranteed-badge">Guaranteed</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// Progress bar rendering
function renderProgressBar(percent) {
  return `
    <div class="progress-bar-container">
      <div class="progress-bar" style="width:${percent}%;"></div>
    </div>
  `;
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = renderProgressBar(0) + '<div>Loading...</div>';
  let allData = [];
  let loaded = 0;
  const total = 3; // Update if you change the number of JSONs

  await fetchAllData(async (flat, url, err) => {
    loaded++;
    const percent = Math.round((loaded / total) * 100);
    container.innerHTML = renderProgressBar(percent) + '<div>Loading...</div>';
    if (err) {
      container.innerHTML += `<div class="error">Failed to load ${url}: ${err}</div>`;
      return;
    }
    if (flat.length === 0) return;
    const enriched = await enrichData(flat);
    allData = allData.concat(enriched);
    const grouped = groupAndSort(allData);

    container.innerHTML = renderProgressBar(percent);
    grouped.forEach(exp => {
      const expDiv = createCard('expansion-card', `<h2>${exp.expansion}</h2>`);
      exp.sources.forEach(src => {
        const srcDiv = createCard('source-card', `<h3>${src.sourcename}</h3>`);
        src.items.forEach(item => {
          const details = Object.entries(item)
            .filter(([k]) => k !== 'loot' && k !== 'expansion' && k !== 'sourcename')
            .map(([k, v]) => {
              if (k === 'wikiLink' && v) return `<div><strong>Wiki:</strong> <a href="${v}" target="_blank">${item.name}</a></div>`;
              if (k === 'mapWikiLink' && v) return `<div><strong>Map Wiki:</strong> <a href="${v}" target="_blank">${item.map}</a></div>`;
              return `<div><strong>${k}:</strong> ${Array.isArray(v) ? JSON.stringify(v) : v}</div>`;
            })
            .join('');
          const lootSection = renderLoot(item.loot);
          const copyBar = createCopyBar(item);
          const itemDiv = createCard('item-card', `<div>${details}${lootSection}${copyBar}</div>`);
          srcDiv.appendChild(itemDiv);
        });
        expDiv.appendChild(srcDiv);
      });
      container.appendChild(expDiv);
    });
  });

  // TODO: For very large lists, implement virtualization/pagination here.
}
renderApp('app');
