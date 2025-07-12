(function() {
  // --- 1. Inject Menu Styles (scoped to #exp-source-menu) ---
  if (!document.getElementById('menu-style')) {
    const style = document.createElement('style');
    style.id = 'menu-style';
    style.textContent = `
      #exp-source-menu {
        margin-bottom: 2em;
        background: #232c3b;
        border-radius: 12px;
        box-shadow: 0 2px 12px #0002;
        padding: 1.3em 1.5em 1.1em 1.5em;
        max-width: 320px;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      .expansion-group {
        margin-bottom: 1.1em;
      }
      .expansion-btn {
        background: #232c3b;
        color: #4a90e2;
        font-size: 1.13em;
        font-weight: bold;
        border: none;
        border-radius: 4px;
        padding: 0.5em 1em;
        cursor: pointer;
        width: 100%;
        text-align: left;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background 0.18s, color 0.18s;
        outline: none;
      }
      .expansion-btn.active,
      .expansion-btn:focus {
        background: #2b4765;
        color: #fff;
      }
      .expansion-btn .arrow {
        font-size: 1.1em;
        margin-left: 0.5em;
        transition: transform 0.2s;
      }
      .expansion-btn.collapsed .arrow {
        transform: rotate(-90deg);
      }
      ul.expansion-subs {
        list-style: none;
        padding: 0 0 0 0.2em;
        margin: 0;
        transition: max-height 0.2s;
        overflow: hidden;
      }
      ul.expansion-subs.collapsed {
        display: none;
      }
      #exp-source-menu li {
        margin: 0.15em 0 0.15em 0;
      }
      #exp-source-menu .menu-btn {
        background: #2b4765;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 0.38em 1.1em;
        font-size: 1em;
        cursor: pointer;
        font-weight: bold;
        letter-spacing: 0.01em;
        transition: background 0.18s, color 0.18s, transform 0.18s;
        outline: none;
        box-shadow: 0 1px 4px #0001;
        width: 100%;
        text-align: left;
      }
      #exp-source-menu .menu-btn:hover, #exp-source-menu .menu-btn:focus {
        background: #4a90e2;
        color: #fff;
        transform: scale(1.04);
      }
      #exp-source-menu .menu-btn.active {
        background: #4a90e2;
        color: #fff;
        transform: scale(1.08);
      }
      @media (max-width: 600px) {
        #exp-source-menu {
          max-width: 98vw;
          padding: 1em 2vw 1em 2vw;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // --- 2. Menu Builder ---
  function buildMenu(events) {
    const grouped = {};
    events.forEach(ev => {
      const exp = ev.expansion || 'Unknown Expansion';
      const src = ev._sourceName || 'Unknown Source';
      if (!grouped[exp]) grouped[exp] = new Set();
      grouped[exp].add(src);
    });
    Object.keys(grouped).forEach(exp => grouped[exp] = Array.from(grouped[exp]));
    let html = '<nav id="exp-source-menu">';
    Object.entries(grouped).forEach(([exp, sources], i) => {
      html += `
        <div class="expansion-group">
          <button class="expansion-btn" data-exp="${encodeURIComponent(exp)}" data-idx="${i}">
            <span>${exp}</span>
            <span class="arrow">&#9660;</span>
          </button>
          <ul class="expansion-subs" id="exp-subs-${i}">
      `;
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

  // --- 3. Inject Menu ---
  function injectMenu(events) {
    let target = document.getElementById('menu-sidebar') || document.body;
    const oldMenu = target.querySelector('#exp-source-menu');
    if (oldMenu) oldMenu.remove();
    const menuDiv = document.createElement('div');
    menuDiv.innerHTML = buildMenu(events);
    target.innerHTML = '';
    target.appendChild(menuDiv.firstChild);

    // --- 4. Uitklapbaar & Klikbaar Expansion ---
    menuDiv.querySelectorAll('.expansion-btn').forEach(btn => {
      const idx = btn.getAttribute('data-idx');
      const subs = menuDiv.querySelector(`#exp-subs-${idx}`);
      const arrow = btn.querySelector('.arrow');
      // Expansion klik: filter op expansion + toggle subs
      btn.onclick = function(e) {
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        // Filteren op expansion
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}"`);
        }
        // Toggle subs
        const isCollapsed = subs.style.display === 'none';
        if (isCollapsed) {
          subs.style.display = '';
          arrow.innerHTML = '&#9660;';
          btn.classList.remove('collapsed');
        } else {
          subs.style.display = 'none';
          arrow.innerHTML = '&#9654;';
          btn.classList.add('collapsed');
        }
        // Active state
        menuDiv.querySelectorAll('.expansion-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Optioneel: deselecteer alle subs
        menuDiv.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
      };
      // Standaard open (of dicht, zet hieronder op 'none' voor standaard dicht)
      subs.style.display = '';
    });

    // Subs klik: filter op expansion + source
    menuDiv.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = function(e) {
        e.stopPropagation();
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        const src = decodeURIComponent(btn.getAttribute('data-src'));
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        }
        // Active state
        menuDiv.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Optioneel: highlight de parent expansion
        const idx = btn.closest('.expansion-group').querySelector('.expansion-btn');
        menuDiv.querySelectorAll('.expansion-btn').forEach(b => b.classList.remove('active'));
        if (idx) idx.classList.add('active');
      };
    });
  }

  // --- 5. Wait for events and render ---
  function waitForEvents() {
    if (window.allEvents && Array.isArray(window.allEvents) && window.allEvents.length > 0) {
      injectMenu(window.allEvents);
    } else {
      setTimeout(waitForEvents, 100);
    }
  }

  if (document.readyState !== 'loading') waitForEvents();
  else document.addEventListener('DOMContentLoaded', waitForEvents);

  // --- 6. Optioneel: Expose reload for debugging ---
  window.menuReload = waitForEvents;
})();
