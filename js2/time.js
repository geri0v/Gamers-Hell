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

    // ...rest of your state and logic stays unchanged...
    this.EVENTS_JSON_URL = 'https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/master/Events%20Module/ref/events.json';
    this.events = [];
    this.timerInterval = null;
    this.selectedTimezone = localStorage.getItem('ghc-timezone') || 'Europe/Amsterdam';
  }

  // ...rest of the class remains unchanged...
  // (All methods: connectedCallback, fetchEvents, updateEvents, etc.)
}
customElements.define('gw2-event-timer', Gw2EventTimer);
