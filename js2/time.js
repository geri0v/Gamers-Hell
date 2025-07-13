class Gw2EventTimer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // HTML template only (no <style>)
    this.shadowRoot.innerHTML = `
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
