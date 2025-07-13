class Gw2EventTimer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Use only CSS variables for theme!
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          box-sizing: border-box;
        }
        .timer-container {
          margin-top: 40px;
          background: var(--card-bg, #263142);
          color: var(--main-fg, #f3f7fa);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          padding: 32px 16px 24px 16px;
          max-width: var(--timer-max-width, 100vw);
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          flex: 1 1 0;
          min-width: 0;
          min-height: 0;
        }
        .timer-controls {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
          justify-content: flex-end;
        }
        label {
          font-size: 1rem;
          margin-right: 6px;
        }
        select, button {
          font-size: 1rem;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #ccc;
          margin: 0;
          background: var(--input-bg, #2c3746);
          color: var(--input-fg, #e1e6ed);
        }
        button {
          background: var(--accent, #4a90e2);
          color: var(--copy-btn-color, #fff);
          cursor: pointer;
          border: none;
          font-weight: bold;
          transition: background 0.2s;
        }
        button:hover {
          background: #3c6e8d;
        }
        .event-list {
          width: 100%;
          font-size: 1.1rem;
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .event-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--table-border, #3b4b63);
          background: none;
          border-radius: 0;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          user-select: none;
        }
        .event-row.upcoming {
          background: var(--section-title-bg, #232c3b);
          color: var(--section-title-fg, #e1e6ed);
          font-weight: bold;
          border-radius: 4px;
        }
        .event-row:hover {
          background: var(--accent, #4a90e2);
          color: #fff;
        }
        .event-info {
          display: flex;
          flex-direction: column;
          flex: 2;
          min-width: 0;
        }
        .event-name {
          font-weight: bold;
          font-size: 1.08em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-location {
          font-size: 0.98em;
          color: #f1c40f;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-waypoint {
          font-size: 0.95em;
          color: #7ed6df;
          margin-left: 2px;
          white-space: nowrap;
        }
        .event-time {
          flex: 1.2;
          text-align: right;
          font-family: monospace;
          font-size: 1.07em;
          min-width: 70px;
          margin-left: 4px;
        }
        .event-countdown {
          display: block;
          font-size: 0.93em;
          color: #f1c40f;
          text-align: right;
        }
        .spinner {
          border: 4px solid #eee;
          border-top: 4px solid var(--accent, #4a90e2);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          animation: spin 1s linear infinite;
          margin: 30px auto;
          display: block;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        #toast {
          position: fixed;
          left: 50%;
          bottom: 36px;
          transform: translateX(-50%) scale(0.9);
          background: var(--copy-bar-bg, #243049);
          color: var(--main-fg, #f3f7fa);
          border-radius: 8px;
          padding: 12px 32px;
          font-size: 1.1em;
          opacity: 0;
          pointer-events: none;
          z-index: 3001;
          box-shadow: 0 4px 24px #0005;
          transition: opacity 0.3s, transform 0.3s;
        }
        #toast.show {
          opacity: 1;
          transform: translateX(-50%) scale(1);
          pointer-events: auto;
        }
        @media (max-width: 600px) {
          .timer-container {
            max-width: 98vw;
            padding: 12px 2vw 16px 2vw;
          }
          .event-list { font-size: 1rem; }
        }
      </style>
      <div class="timer-container">
        <div class="timer-controls">
          <label for="timezoneSelect">Timezone:</label>
          <select id="timezoneSelect" aria-label="Choose timezone"></select>
          <button id="refreshEventsBtn" title="Refresh events" aria-label="Refresh events">&#x21bb;</button>
        </div>
        <div class="event-list" id="eventList" tabindex="0" aria-live="polite" aria-relevant="additions">
          <div class="spinner"></div>
        </div>
      </div>
      <div id="toast" role="alert" aria-live="assertive" aria-atomic="true"></div>
    `;

    // State
    this.EVENTS_JSON_URL = 'https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/master/Events%20Module/ref/events.json';
    this.events = [];
    this.timerInterval = null;
    this.selectedTimezone = localStorage.getItem('ghc-timezone') || 'Europe/Amsterdam';
  }

  // ...rest of your methods remain unchanged...
  // (connectedCallback, fetchEvents, updateEvents, etc.)
  // (No logic changes needed unless you want new features)
}

customElements.define('gw2-event-timer', Gw2EventTimer);
