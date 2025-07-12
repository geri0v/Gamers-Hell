// menu.js - Hybrid Modern Version
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
        max-width: 350px;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      #exp-source-menu .expansion-group {
        margin-bottom: 1.1em;
      }
      #exp-source-menu .expansion-title {
        color: #4a90e2;
        font-size: 1.13em;
        font-weight: bold;
        margin-bottom: 0.3em;
        letter-spacing: 0.01em;
        display: flex;
        align-items: center;
        gap: 0.4em;
      }
      #exp-source-menu ul {
        list-style: none;
        padding: 0 0 0 0.2em;
        margin: 0;
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
    Object.entries(grouped).forEach(([exp, sources]) => {
      html += `<div class="expansion-group">
        <div class="expansion-title">${exp}</div>
        <ul>`;
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
  let target = window.menuInjectTarget || document.getElementById('menu-sidebar') || document.body;
    const oldMenu = document.getElementById('exp-source-menu');
    if (oldMenu) oldMenu.remove();
    const menuDiv = document.createElement('div');
    menuDiv.innerHTML = buildMenu(events);
    target.prepend(menuDiv.firstChild);

    // --- 4. Click Handlers and Active State ---
    document.querySelectorAll('#exp-source-menu .menu-btn').forEach(btn => {
      btn.onclick = function() {
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        const src = decodeURIComponent(btn.getAttribute('data-src'));
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        }
        // Active state
        document.querySelectorAll('#exp-source-menu .menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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

  // --- 6. Optional: Expose reload for debugging ---
  window.menuReload = waitForEvents;
})();
