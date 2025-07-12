class Gw2EventTimer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // HTML and CSS template
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --main-bg: #f8fcff;
          --main-fg: #222;
          --accent: #2b4765;
          --event-upcoming-bg: #29334a;
          --event-upcoming-fg: #fff;
          --toast-bg: #222c;
          --toast-fg: #fff;
        }
        body {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          font-family: Arial, sans-serif;
          background: var(--main-bg);
          color: var(--main-fg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
        }
        .timer-container {
          margin-top: 40px;
          background: #222;
          color: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          padding: 32px 16px 24px 16px;
          max-width: 540px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
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
        }
        button {
          background: var(--accent);
          color: #fff;
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
        }
        .event-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #333;
          background: none;
          border-radius: 0;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          user-select: none;
        }
        .event-row.upcoming {
          background: var(--event-upcoming-bg);
          color: var(--event-upcoming-fg);
          font-weight: bold;
          border-radius: 4px;
        }
        .event-row:hover {
          background: #2b4765bb;
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
          border-top: 4px solid var(--accent);
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
          background: var(--toast-bg);
          color: var(--toast-fg);
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

  connectedCallback() {
    this.populateTimezoneSelect();
    this.fetchEvents();
    this.shadowRoot.getElementById('refreshEventsBtn').addEventListener('click', () => this.fetchEvents(true));
    setInterval(() => this.fetchEvents(), 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.fetchEvents();
    });
  }

  getAllTimezones() {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [
        "Europe/Amsterdam", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"
      ];
    }
  }

  populateTimezoneSelect() {
    const tzSelect = this.shadowRoot.getElementById('timezoneSelect');
    tzSelect.innerHTML = '';
    this.getAllTimezones().forEach(tz => {
      const opt = document.createElement('option');
      opt.value = tz;
      opt.textContent = tz.replace('_',' ');
      if (tz === this.selectedTimezone) opt.selected = true;
      tzSelect.appendChild(opt);
    });
    tzSelect.addEventListener('change', () => {
      this.selectedTimezone = tzSelect.value;
      localStorage.setItem('ghc-timezone', this.selectedTimezone);
      this.updateEvents();
    });
  }

  parseOffset(offset) {
    let t = offset.replace('Z', '').split(':');
    return { hour: parseInt(t[0], 10), minute: parseInt(t[1], 10) };
  }

  parseRepeat(repeat) {
    let t = repeat.split(':');
    return parseInt(t[0], 10) * 60 + parseInt(t[1], 10);
  }

  getNextOccurrence(offset, repeat) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const { hour, minute } = this.parseOffset(offset);
    let eventTime = new Date(today.getTime());
    eventTime.setUTCHours(hour, minute, 0, 0);
    const repeatMinutes = this.parseRepeat(repeat);
    while (eventTime < now) {
      eventTime = new Date(eventTime.getTime() + repeatMinutes * 60000);
    }
    return eventTime;
  }

  toTimezoneStr(date, tz) {
    return date.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  }

  getCountdownString(target) {
    const now = new Date();
    let diff = Math.max(0, Math.floor((target - now) / 1000));
    let h = Math.floor(diff / 3600);
    let m = Math.floor((diff % 3600) / 60);
    let s = diff % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  async fetchEvents(force) {
    const eventList = this.shadowRoot.getElementById('eventList');
    eventList.innerHTML = '<div class="spinner" role="status" aria-live="polite" aria-label="Loading events"></div>';
    let cache = localStorage.getItem('ghc-events');
    let cacheTime = localStorage.getItem('ghc-events-time');
    if (!force && cache && cacheTime && Date.now() - cacheTime < 1000*60*15) {
      this.events = JSON.parse(cache);
      await this.updateEvents();
      return;
    }
    try {
      const response = await fetch(this.EVENTS_JSON_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      this.events = data.filter(e => e.offset && e.repeat);
      localStorage.setItem('ghc-events', JSON.stringify(this.events));
      localStorage.setItem('ghc-events-time', Date.now());
      this.showToast('Events updated!');
    } catch (err) {
      this.showToast('Failed to load events. Try again later.');
      this.events = [];
    }
    await this.updateEvents();
  }

  async updateEvents() {
    const eventList = this.shadowRoot.getElementById('eventList');
    if (!this.events.length) {
      eventList.innerHTML = '<div style="padding:20px;color:#aaa;">No events available.</div>';
      return;
    }
    const now = new Date();
    let nextEvents = this.events.map(event => {
      const nextTime = this.getNextOccurrence(event.offset, event.repeat);
      return {
        name: event.name,
        location: event.location || "",
        waypoint: event.waypoint || "",
        utcTime: nextTime,
        localTime: this.toTimezoneStr(nextTime, this.selectedTimezone),
        nextTime
      };
    });
    nextEvents.sort((a, b) => a.utcTime - b.utcTime);
    let nextIdx = nextEvents.findIndex(ev => ev.utcTime > now);
    if (nextIdx === -1) nextIdx = 0;
    let html = '';
    nextEvents.forEach((event, idx) => {
      const copyText = event.name + 
        (event.location ? ` | ${event.location}` : "") + 
        (event.waypoint ? ` | ${event.waypoint}` : "");
      html += `<div class="event-row${idx === nextIdx ? ' upcoming' : ''}" 
        tabindex="0" 
        role="listitem"
        data-copy="${encodeURIComponent(copyText)}"
        title="Click to copy event info">
        <div class="event-info">
          <span class="event-name">${event.name}</span>
          ${event.location ? `<span class="event-location">${event.location}</span>` : ""}
          ${event.waypoint ? `<span class="event-waypoint">${event.waypoint}</span>` : ""}
        </div>
        <span class="event-time">
          ${event.localTime}
          <span class="event-countdown" data-idx="${idx}"></span>
        </span>
      </div>`;
    });
    eventList.innerHTML = html || `<div style="padding:20px;color:#aaa;">No events match your search.</div>`;

    this.shadowRoot.querySelectorAll('.event-row').forEach(row => {
      row.addEventListener('click', e => {
        const text = decodeURIComponent(row.getAttribute('data-copy'));
        this.copyEventInfo(text);
      });
      row.addEventListener('keydown', e => {
        if (e.key === "Enter" || e.key === " ") {
          const text = decodeURIComponent(row.getAttribute('data-copy'));
          this.copyEventInfo(text);
          e.preventDefault();
        }
      });
    });

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.shadowRoot.querySelectorAll('.event-countdown').forEach(span => {
        const idx = +span.getAttribute('data-idx');
        if (nextEvents[idx]) {
          span.textContent = "Next in: " + this.getCountdownString(nextEvents[idx].nextTime);
        }
      });
    }, 1000);
  }

  copyEventInfo(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied!');
      }, () => {
        this.fallbackCopyTextToClipboard(text);
      });
    } else {
      this.fallbackCopyTextToClipboard(text);
    }
  }

  fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-1000px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast('Copied!');
    } catch (err) {
      this.showToast('Copy failed');
    }
    document.body.removeChild(textArea);
  }

  showToast(msg) {
    const toast = this.shadowRoot.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }
}

customElements.define('gw2-event-timer', Gw2EventTimer);
