(function() {
  // --- 1. Menu Builder ---
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

  // --- 2. Inject Menu ---
  function injectMenu(events) {
    let target = document.getElementById('menu-sidebar') || document.body;
    const oldMenu = target.querySelector('#exp-source-menu');
    if (oldMenu) oldMenu.remove();
    const menuDiv = document.createElement('div');
    menuDiv.innerHTML = buildMenu(events);
    target.innerHTML = '';
    target.appendChild(menuDiv.firstChild);

    // --- 3. Expand/Collapse and Click Logic ---
    menuDiv.querySelectorAll('.expansion-btn').forEach(btn => {
      const idx = btn.getAttribute('data-idx');
      const subs = menuDiv.querySelector(`#exp-subs-${idx}`);
      const arrow = btn.querySelector('.arrow');
      btn.onclick = function(e) {
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}"`);
        }
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
        menuDiv.querySelectorAll('.expansion-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        menuDiv.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
      };
      subs.style.display = '';
    });

    menuDiv.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = function(e) {
        e.stopPropagation();
        const exp = decodeURIComponent(btn.getAttribute('data-exp'));
        const src = decodeURIComponent(btn.getAttribute('data-src'));
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        }
        menuDiv.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const idx = btn.closest('.expansion-group').querySelector('.expansion-btn');
        menuDiv.querySelectorAll('.expansion-btn').forEach(b => b.classList.remove('active'));
        if (idx) idx.classList.add('active');
      };
    });
  }

  // --- 4. Wait for events and render ---
  function waitForEvents() {
    if (window.allEvents && Array.isArray(window.allEvents) && window.allEvents.length > 0) {
      injectMenu(window.allEvents);
    } else {
      setTimeout(waitForEvents, 100);
    }
  }

  if (document.readyState !== 'loading') waitForEvents();
  else document.addEventListener('DOMContentLoaded', waitForEvents);

  window.menuReload = waitForEvents;
})();
