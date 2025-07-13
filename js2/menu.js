class GhMenuSidebar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .menu-container {
          background: var(--card-bg, #263142);
          color: var(--main-fg, #f3f7fa);
          border-radius: 0 16px 16px 0;
          box-shadow: 2px 0 16px #0005;
          padding: 32px 0 24px 0;
          min-width: 200px;
          width: 220px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 1.5em;
        }
        .menu-header {
          font-size: 1.3em;
          font-weight: bold;
          padding: 0 1.5em;
          margin-bottom: 1em;
        }
        nav {
          display: flex;
          flex-direction: column;
          gap: 1em;
        }
        .menu-link {
          color: var(--accent, #4a90e2);
          background: none;
          border: none;
          text-align: left;
          font-size: 1.08em;
          padding: 0.6em 1.5em;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .menu-link.active,
        .menu-link:hover {
          background: var(--accent, #4a90e2);
          color: #fff;
        }
        .menu-footer {
          margin-top: auto;
          padding: 1em 1.5em 0.5em 1.5em;
          font-size: 0.98em;
          color: #b3c6e0;
        }
        @media (max-width: 900px) {
          .menu-container {
            width: 100vw;
            min-width: 0;
            border-radius: 0 0 16px 16px;
          }
        }
      </style>
      <div class="menu-container">
        <div class="menu-header">Menu</div>
        <nav>
          <button class="menu-link" data-section="events">Events</button>
          <button class="menu-link" data-section="timer">Timer</button>
          <button class="menu-link" data-section="about">About</button>
        </nav>
        <div class="menu-footer">© 2025 Gamers-Hell</div>
      </div>
    `;
  }

  connectedCallback() {
    this.shadowRoot.querySelectorAll('.menu-link').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.menu-link').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Custom event for main app to listen to
        this.dispatchEvent(new CustomEvent('navigate', {
          detail: { section: btn.dataset.section },
          bubbles: true,
          composed: true
        }));
      });
    });
  }
}

customElements.define('gh-menu-sidebar', GhMenuSidebar);
