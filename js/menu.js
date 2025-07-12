class Gw2EventMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        /* ... (styles unchanged) ... */
      </style>
      <div class="menu-container closed">
        <div class="menu-header">
          <span>Menu</span>
          <button class="toggle-btn" id="toggleBtn">Toon menu</button>
        </div>
        <nav class="menu-list" id="menuList" aria-label="Event menu"></nav>
      </div>
    `;
    this.menuContainer = this.shadowRoot.querySelector('.menu-container');
    this.toggleBtn = this.shadowRoot.getElementById('toggleBtn');
    this.menuList = this.shadowRoot.getElementById('menuList');
    this.open = false;
  }

  connectedCallback() {
    this.toggleBtn.addEventListener('click', () => this.toggleMenu());
    this.setMenuDefault();
    window.addEventListener('resize', () => this.setMenuDefault());
    this.renderMenuWhenReady();
  }

  setMenuDefault() {
    if (window.innerWidth < 900) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    this.open = true;
    this.menuContainer.classList.remove('closed');
    this.toggleBtn.textContent = "Verberg menu";
  }
  closeMenu() {
    this.open = false;
    this.menuContainer.classList.add('closed');
    this.toggleBtn.textContent = "Toon menu";
  }
  toggleMenu() {
    if (this.open) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  renderMenuWhenReady() {
    // Wait for cmd.js to finish loading
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
