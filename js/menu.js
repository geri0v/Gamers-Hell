// menu.js
(function() {
  function buildMenu(events) {
    const grouped = {};
    events.forEach(ev => {
      const exp = ev.expansion || 'Unknown Expansion';
      const src = ev._sourceName || 'Unknown Source';
      if (!grouped[exp]) grouped[exp] = new Set();
      grouped[exp].add(src);
    });
    Object.keys(grouped).forEach(exp => grouped[exp] = Array.from(grouped[exp]));
    let html = '<nav id="exp-source-menu" style="margin-bottom:2em;background:#232c3b;border-radius:10px;padding:1em 1.5em;max-width:350px;box-shadow:0 2px 12px #0002;">';
    Object.entries(grouped).forEach(([exp, sources]) => {
      html += `<div style="margin-bottom:1em;"><b style="color:#4a90e2;font-size:1.1em;">${exp}</b><ul style="list-style:none;padding:0;margin:0.3em 0 0.7em 0.5em;">`;
      sources.forEach(src => {
        html += `<li style="margin:0.2em 0;">
          <button class="menu-btn" data-exp="${encodeURIComponent(exp)}" data-src="${encodeURIComponent(src)}"
            style="background:#2b4765;color:#fff;border:none;border-radius:4px;padding:0.3em 0.8em;cursor:pointer;font-size:1em;transition:background 0.2s;">
            ${src}
          </button>
        </li>`;
      });
      html += `</ul></div>`;
    });
    html += '</nav>';
    return html;
  }

  function injectMenu(events) {
    let target = document.getElementById('mainContent') || document.body;
    const oldMenu = document.getElementById('exp-source-menu');
    if (oldMenu) oldMenu.remove();
    const menuDiv = document.createElement('div');
    menuDiv.innerHTML = buildMenu(events);
    target.prepend(menuDiv.firstChild);

    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = function() {
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        const src = decodeURIComponent(btn.getAttribute('data-src'));
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        }
      };
    });
  }

  // Wacht tot allEvents gevuld is
  function waitForEvents() {
    if (window.allEvents && Array.isArray(window.allEvents) && window.allEvents.length > 0) {
      injectMenu(window.allEvents);
    } else {
      setTimeout(waitForEvents, 100);
    }
  }

  if (document.readyState !== 'loading') waitForEvents();
  else document.addEventListener('DOMContentLoaded', waitForEvents);
})();
