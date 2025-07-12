// menu.js - Sidebar, Shadow DOM, eigen CSS, werkt met cmd.js
(function() {
  class GhcSidebarMenu extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }
          nav#exp-source-menu {
            margin-bottom: 2em;
            background: #232c3b;
            border-radius: 12px;
            box-shadow: 0 2px 12px #0002;
            padding: 1.3em 1.5em 1.1em 1.5em;
            max-width: 320px;
            font-family: 'Segoe UI', Arial, sans-serif;
          }
          .expansion-group { margin-bottom: 1.1em; }
          .expansion-title {
            color: #4a90e2;
            font-size: 1.13em;
            font-weight: bold;
            margin-bottom: 0.3em;
            letter-spacing: 0.01em;
            display: flex;
            align-items: center;
            gap: 0.4em;
          }
          ul {
            list-style: none;
            padding: 0 0 0 0.2em;
            margin: 0;
          }
          li { margin: 0.15em 0 0.15em 0; }
          .menu-btn {
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
          .menu-btn:hover, .menu-btn:focus {
            background: #4a90e2;
            color: #fff;
            transform: scale(1.04);
          }
          .menu-btn.active {
            background: #4a90e2;
            color: #fff;
            transform: scale(1.08);
          }
          @media (max-width: 600px) {
            nav#exp-source-menu { max-width: 98vw; padding: 1em 2vw 1em 2vw; }
          }
        </style>
        <div id="menuContent"></div>
      `;
      this._events = [];
    }

    connectedCallback() {
      this.waitForEvents();
    }

    waitForEvents() {
      if (window.allEvents && Array.isArray(window.allEvents) && window.allEvents.length > 0) {
        this._events = window.allEvents;
        this.renderMenu();
      } else {
        setTimeout(() => this.waitForEvents(), 100);
      }
    }

    renderMenu() {
      const grouped = {};
      this._events.forEach(ev => {
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
      this.shadowRoot.getElementById('menuContent').innerHTML = html;

      // Click handlers
      this.shadowRoot.querySelectorAll('.menu-btn').forEach(btn => {
        btn.onclick = () => {
          const exp = decodeURIComponent(btn.getAttribute('data-exp'));
          const src = decodeURIComponent(btn.getAttribute('data-src'));
          if (window.cmd_run) {
            window.cmd_run(`show expansion "${exp}" source "${src}"`);
          }
          // Active state
          this.shadowRoot.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        };
      });
    }
  }

  customElements.define('ghc-sidebar-menu', GhcSidebarMenu);

  // Injecteer menu in #menu-sidebar
  document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('menu-sidebar');
    if (sidebar && !sidebar.querySelector('ghc-sidebar-menu')) {
      sidebar.appendChild(document.createElement('ghc-sidebar-menu'));
    }
  });
})();
