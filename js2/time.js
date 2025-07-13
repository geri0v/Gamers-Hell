class Gw2EventTimer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // HTML + CSS (using only CSS variables for theme)
    this.shadowRoot.innerHTML = `
      <style>
        .timer-container {
          background: var(--card-bg, #263142);
          color: var(--main-fg, #f3f7fa);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          padding: 32px 16px 24px 16px;
          max-width: var(--timer-max-width, 100vw);
          width: 100%;
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

    this.EVENTS_JSON_URL = 'https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/master/Events%20Module/ref/events.json';
    this.events = [];
    this.timerInterval = null;
    this.selectedTimezone = localStorage.getItem('ghc-timezone') || 'Europe/Amsterdam';

    // Bind methods
    this.updateEvents = this.updateEvents.bind(this);
    this.showToast = this.showToast.bind(this);
  }

  connectedCallback() {
    this.timezoneSelect = this.shadowRoot.getElementById('timezoneSelect');
    this.refreshBtn = this.shadowRoot.getElementById('refreshEventsBtn');
    this.eventList = this.shadowRoot.getElementById('eventList');
    this.toast = this.shadowRoot.getElementById('toast');

    // Populate timezone select
    this.populateTimezones();

    // Event listeners
    this.timezoneSelect.addEventListener('change', () => {
      this.selectedTimezone = this.timezoneSelect.value;
      localStorage.setItem('ghc-timezone', this.selectedTimezone);
      this.updateEvents();
    });
    this.refreshBtn.addEventListener('click', () => {
      this.fetchEvents(true);
    });

    // Initial fetch
    this.fetchEvents();

    // Start timer for live countdowns
    this.timerInterval = setInterval(() => this.updateEvents(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this.timerInterval);
  }

  async fetchEvents(force = false) {
    if (this.events.length && !force) {
      this.updateEvents();
      return;
    }
    this.eventList.innerHTML = `<div class="spinner"></div>`;
    try {
      const resp = await fetch(this.EVENTS_JSON_URL);
      this.events = await resp.json();
      this.updateEvents();
      this.showToast('Events loaded.');
    } catch (e) {
      this.eventList.innerHTML = `<div style="color:red;">Failed to load events.</div>`;
      this.showToast('Failed to load events.', true);
    }
  }

  updateEvents() {
    if (!this.events.length) return;
    const now = new Date();
    const tz = this.selectedTimezone;
    // Sort events by next occurrence
    const eventsWithTimes = this.events.map(ev => {
      const next = this.getNextOccurrence(ev, now, tz);
      return { ...ev, next };
    }).sort((a, b) => a.next - b.next);

    // Render events
    this.eventList.innerHTML = eventsWithTimes.map(ev => {
      const nextDate = ev.next ? this.formatDate(ev.next, tz) : 'N/A';
      const countdown = ev.next ? this.formatCountdown(ev.next, now) : '';
      return `
        <div class="event-row${countdown && !countdown.startsWith('-') && countdown !== 'Now!' ? '' : ' upcoming'}" title="${ev.name}">
          <div class="event-info">
            <span class="event-name">${ev.name}</span>
            <span class="event-location">${ev.map || ''}</span>
            <span class="event-waypoint">${ev.waypoint || ''}</span>
          </div>
          <div class="event-time">
            ${nextDate}
            <span class="event-countdown">${countdown}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Calculate the next occurrence of the event (UTC times, then convert to tz)
  getNextOccurrence(ev, now, tz) {
    if (!ev.times || !Array.isArray(ev.times)) return null;
    const today = new Date(now);
    for (let i = 0; i <= 1; i++) { // today and tomorrow
      for (const t of ev.times) {
        // t is in "HH:mm" UTC
        const [h, m] = t.split(':').map(Number);
        const candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i, h, m));
        if (candidate > now) {
          return candidate;
        }
      }
    }
    return null;
  }

  // Format date in selected timezone
  formatDate(date, tz) {
    try {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: tz,
        hour12: false
      }) + ` (${tz})`;
    } catch {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  }

  // Format countdown (e.g. "12m 10s")
  formatCountdown(target, now) {
    let diff = Math.floor((target - now) / 1000);
    if (diff < 0) return 'Now!';
    const h = Math.floor(diff / 3600);
    diff %= 3600;
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return (h ? `${h}h ` : '') + (m ? `${m}m ` : '') + `${s}s`;
  }

  // Populate timezone dropdown
  populateTimezones() {
    const zones = [
      'UTC', 'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'America/New_York',
      'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'
    ];
    this.timezoneSelect.innerHTML = zones.map(z =>
      `<option value="${z}"${z === this.selectedTimezone ? ' selected' : ''}>${z}</option>`
    ).join('');
  }

  showToast(msg, error = false) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.className = error ? 'show error' : 'show';
    setTimeout(() => {
      this.toast.className = '';
    }, 2000);
  }
}

customElements.define('gw2-event-timer', Gw2EventTimer);
