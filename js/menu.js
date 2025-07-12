// menu.js
// Dynamisch menu: Expansions > SourceName, communiceert met cmd.js

(function() {
  // === CONFIGUREER JE JSON SOURCES HIER ===
  const jsonSources = [
    {
      name: "Temples of Orr",
      url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json"
    },
    {
      name: "Valuable Events",
      url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json"
    }
    // Voeg hier meer bronnen toe indien gewenst!
  ];

  // === STYLING (optioneel, kun je aanpassen of weglaten als je eigen CSS gebruikt) ===
  const style = document.createElement('style');
  style.textContent = `
    #exp-source-menu {
      margin-bottom: 2em;
      background: #232c3b;
      border-radius: 10px;
      padding: 1em 1.5em 1em 1.5em;
      max-width: 350px;
      box-shadow: 0 2px 12px #0002;
    }
    #exp-source-menu b {
      color: #4a90e2;
      font-size: 1.1em;
      display: block;
      margin-bottom: 0.4em;
    }
    #exp-source-menu ul {
      list-style: none;
      padding: 0;
      margin: 0.3em 0 0.7em 0.5em;
    }
    #exp-source-menu li {
      margin: 0.2em 0;
    }
    #exp-source-menu .menu-btn {
      background: #2b4765;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 0.3em 0.8em;
      cursor: pointer;
      font-size: 1em;
      transition: background 0.2s;
    }
    #exp-source-menu .menu-btn:hover {
      background: #4a90e2;
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  // === 1. JSONS UITLEZEN ===
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

  // === 2. MENU BOUWEN ===
  function buildExpSourceMenu(events) {
    const grouped = {};
    events.forEach(ev => {
      const exp = ev.expansion || 'Unknown Expansion';
      const src = ev._sourceName || 'Unknown Source';
      if (!grouped[exp]) grouped[exp] = new Set();
      grouped[exp].add(src);
    });
    Object.keys(grouped).forEach(exp => grouped[exp] = Array.from(grouped[exp]));
    let html = '<nav id="exp-source-menu">';
    Object.entries(grouped).forEach(([exp, sources]) => {
      html += `<div style="margin-bottom:1em;"><b>${exp}</b><ul>`;
      sources.forEach(src => {
        html += `<li>
          <button class="menu-btn" data-exp="${encodeURIComponent(exp)}" data-src="${encodeURIComponent(src)}">
            ${src}
          </button>
        </li>`;
      });
      html += `</ul></div>`;
    });
    html += '</nav>';
    return html;
  }

  // === 3. MENU INJECTEREN EN KOPPELEN ===
  async function initMenu() {
    const events = await fetchAllEvents();

    // Voeg menu toe aan mainContent of body
    let target = document.getElementById('mainContent') || document.body;
    // Verwijder bestaand menu als het er is
    const oldMenu = document.getElementById('exp-source-menu');
    if (oldMenu) oldMenu.remove();

    // Voeg menu toe (bovenaan)
    const menuDiv = document.createElement('div');
    menuDiv.innerHTML = buildExpSourceMenu(events);
    target.prepend(menuDiv.firstChild);

    // Voeg click-handlers toe
    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = function() {
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        const src = decodeURIComponent(btn.getAttribute('data-src'));
        // Stuur commando naar cmd.js (indien aanwezig)
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        } else {
          alert(`Menu: ${exp} > ${src}`);
        }
      };
    });
  }

  // === 4. START MENU ===
  if (document.readyState !== 'loading') initMenu();
  else document.addEventListener('DOMContentLoaded', initMenu);

  // (Optioneel) Exporteer functie voor herladen
  window.menuReload = initMenu;
})();
