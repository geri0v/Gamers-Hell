class Gw2EventMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --main-bg: #232c3b;
          --main-fg: #f3f7fa;
          --accent: #2b4765;
          --menu-width: 220px;
          --menu-width-mobile: 100vw;
          --menu-header-bg: #29334a;
          --menu-header-fg: #fff;
          --expansion-color: #f1c40f;
          --source-color: #7ed6df;
          --source-hover-bg: #2b4765;
          display: block;
          height: 100%;
        }
        .menu-container {
          background: var(--main-bg);
          color: var(--main-fg);
          width: var(--menu-width);
          min-width: 120px;
          max-width: 320px;
          height: 100vh;
          box-shadow: 2px 0 10px #0002;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: width 0.3s;
        }
        .menu-header {
          background: var(--menu-header-bg);
          color: var(--menu-header-fg);
          font-weight: bold;
          font-size: 1.13em;
          padding: 18px 18px 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #2b4765;
        }
        .toggle-btn {
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 1em;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }
        .toggle-btn:hover {
          background: #3c6e8d;
        }
        .menu-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 0 16px 0;
          display: flex;
          flex-direction: column;
        }
        .expansion {
          font-weight: bold;
          color: var(--expansion-color);
          padding: 8px 24px 4px 24px;
          cursor: pointer;
          font-size: 1.08em;
          border-left: 3px solid transparent;
          transition: background 0.2s, border-color 0.2s;
        }
        .expansion:hover {
          background: #2b4765;
          border-left: 3px solid var(--accent);
        }
        .source {
          color: var(--source-color);
          font-size: 0.98em;
          padding: 6px 32px 6px 38px;
          cursor: pointer;
          border-left: 2px solid transparent;
          transition: background 0.2s, border-color 0.2s;
        }
        .source:hover, .source.active {
          background: var(--source-hover-bg);
          border-left: 2px solid var(--accent);
          color: #fff;
        }
        .menu-container.closed {
          width: 0;
          min-width: 0;
          padding: 0;
          overflow: hidden;
        }
        .menu-container.closed .menu-header,
        .menu-container.closed .menu-list {
          display: none;
        }
        @media (max-width: 900px) {
          .menu-container {
            width: var(--menu-width-mobile);
            min-width: 0;
            max-width: 100vw;
            height: auto;
            border-right: none;
            border-bottom: 2px solid var(--accent);
            box-shadow: none;
          }
        }
      </style>
      <div class="menu-container closed">
        <div class="menu-header">
          <span>Menu</span>
          <button class="toggle-btn" id="toggleBtn">Toon menu</button>
        </div>
        <nav class="menu-list" id="menuList"></nav>
      </div>
    `;
    this.menuContainer = this.shadowRoot.querySelector('.menu-container');
    this.toggleBtn = this.shadowRoot.getElementById('toggleBtn');
    this.menuList = this.shadowRoot.getElementById('menuList');
    this.open = false;
  }

  connectedCallback() {
    this.toggleBtn.addEventListener('click', () => this.toggleMenu());
    this.renderMenuWhenReady();
  }

  toggleMenu() {
    this.open = !this.open;
    if (this.open) {
      this.menuContainer.classList.remove('closed');
      this.toggleBtn.textContent = "Verberg menu";
    } else {
      this.menuContainer.classList.add('closed');
      this.toggleBtn.textContent = "Toon menu";
    }
  }

  renderMenuWhenReady() {
    // Wacht tot cmd.js geladen is
    if (window.allEvents && window.allEvents.length && typeof window.groupEvents === "function") {
      const expansions = window.groupEvents(window.allEvents);
      this.renderMenu(expansions);
    } else {
      setTimeout(() => this.renderMenuWhenReady(), 100);
    }
  }

  renderMenu(expansions) {
    this.menuList.innerHTML = '';
    Object.keys(expansions).forEach((expansion, expIdx) => {
      const expEl = document.createElement('div');
      expEl.className = 'expansion';
      expEl.textContent = expansion;
      expEl.tabIndex = 0;
      expEl.onclick = () => {
        const section = document.getElementById('expansion-' + expIdx);
        if (section) section.scrollIntoView({behavior: "smooth"});
      };
      this.menuList.appendChild(expEl);

      Object.keys(expansions[expansion]).forEach((source, srcIdx) => {
        const srcEl = document.createElement('div');
        srcEl.className = 'source';
        srcEl.textContent = '— ' + source;
        srcEl.tabIndex = 0;
        srcEl.onclick = () => {
          const section = document.getElementById(`expansion-${expIdx}-source-${srcIdx}`);
          if (section) section.scrollIntoView({behavior: "smooth"});
        };
        this.menuList.appendChild(srcEl);
      });
    });
  }
}

customElements.define('gw2-event-menu', Gw2EventMenu);
