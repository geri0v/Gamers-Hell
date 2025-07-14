import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

// Helper to render loot/items as subcards if present
function renderLoot(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  return `
    <div class="subcards">
      ${loot.map(l => `
        <div class="subcard">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price !== undefined ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound !== undefined ? `<div><strong>Accountbound:</strong> ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div style="color:green;"><strong>Guaranteed</strong></div>` : ''}
          ${Object.entries(l)
            .filter(([k]) => !['name', 'icon', 'wikiLink', 'price', 'chatCode', 'accountBound', 'guaranteed'].includes(k))
            .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div>Loading...</div>';
  try {
    const rawData = await fetchAllData();
    const enrichedData = await enrichData(rawData);
    const grouped = groupAndSort(enrichedData);

    container.innerHTML = '';
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
          const itemDiv = createCard('item-card', `<div>${details}${lootSection}</div>`);
          srcDiv.appendChild(itemDiv);
        });
        expDiv.appendChild(srcDiv);
      });
      container.appendChild(expDiv);
    });
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load data: ${e}</div>`;
  }
}

renderApp('app');
