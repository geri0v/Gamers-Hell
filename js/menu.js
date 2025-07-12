// menu.js
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
    let html = '<nav id="exp-source-menu" style="margin-bottom:2em;">';
    Object.entries(grouped).forEach(([exp, sources]) => {
      html += `<div style="margin-bottom:1em;"><b>${exp}</b><ul style="margin:0.3em 0 0.7em 1em;">`;
      sources.forEach(src => {
        html += `<li style="margin:0.2em 0;">
          <button class="menu-btn" data-exp="${encodeURIComponent(exp)}" data-src="${encodeURIComponent(src)}"
            style="background:#2b4765;color:#fff;border:none;border-radius:4px;padding:0.3em 0.8em;cursor:pointer;">
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
    // Voeg menu toe aan mainContent of een ander gewenst element
    let target = document.getElementById('mainContent') || document.body;
    // Verwijder bestaand menu als het er is
    const oldMenu = document.getElementById('exp-source-menu');
    if (oldMenu) oldMenu.remove();
    // Voeg menu toe
    const menuDiv = document.createElement('div');
    menuDiv.innerHTML = buildExpSourceMenu(events);
    target.prepend(menuDiv.firstChild);

    // Voeg click-handlers toe
    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = function() {
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        const src = decodeURIComponent(btn.getAttribute('data-src'));
        // cmd.js koppeling
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        } else {
          alert(`Menu: ${exp} > ${src}`);
          // Of: filter direct in de UI, als je daar een functie voor hebt
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
