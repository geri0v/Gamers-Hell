const EVENTS_URL = "https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/refs/heads/master/Events%20Module/ref/events.json";

// Default timezone
let selectedTimeZone = "Europe/Amsterdam";

// Timezone options for selector
const timeZones = [
  "Europe/Amsterdam",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney"
];

function pad(num) { return num.toString().padStart(2, '0'); }

// Parse "HH:MMZ" as a Date object (next occurrence, UTC)
function getEventDate(offset) {
  const [h, m] = offset.replace('Z', '').split(':').map(Number);
  const now = new Date();
  const eventDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  if (eventDate < now) eventDate.setUTCDate(eventDate.getUTCDate() + 1);
  return eventDate;
}

// Calculate countdown (seconds) to event
function getCountdown(eventDate) {
  const now = new Date();
  return Math.floor((eventDate - now) / 1000);
}

// Format countdown as "HH:MM:SS"
function formatCountdown(seconds) {
  if (seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Format a Date object to time string in selected timezone
function formatTimeInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timeZone
  }).format(date);
}

// Format a Date object to short time (HH:MM) in selected timezone
function formatShortTimeInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZone
  }).format(date);
}

// Create timezone selector dropdown
function createTimeZoneSelector() {
  const container = document.createElement('div');
  container.id = 'timezone-selector-container';
  container.style.marginBottom = '12px';
  container.style.textAlign = 'center';
  container.style.color = 'var(--main-fg)';

  const label = document.createElement('label');
  label.htmlFor = 'timezone-select';
  label.textContent = 'Select Timezone: ';
  label.style.marginRight = '8px';

  const select = document.createElement('select');
  select.id = 'timezone-select';
  select.style.padding = '4px 8px';
  select.style.borderRadius = '4px';
  select.style.border = 'none';
  select.style.background = 'var(--input-bg)';
  select.style.color = 'var(--input-fg)';
  select.style.fontSize = '1em';

  timeZones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz;
    option.textContent = tz;
    if (tz === selectedTimeZone) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    selectedTimeZone = select.value;
    updateEvents();
  });

  container.appendChild(label);
  container.appendChild(select);
  return container;
}

// Main render function
function renderEvents(events) {
  const now = new Date();
  const eventList = events.filter(ev => ev.offset).map((ev, idx) => {
    const eventDate = getEventDate(ev.offset);
    return {
      ...ev,
      idx,
      eventDate,
      countdown: getCountdown(eventDate)
    };
  }).filter(ev => ev.countdown >= 0)
    .sort((a, b) => a.countdown - b.countdown);

  const container = document.getElementById('gw2-event-timer');
  container.innerHTML = '';

  // Add timezone selector if not already added
  if (!document.getElementById('timezone-selector-container')) {
    container.appendChild(createTimeZoneSelector());
  }

  let html = `<div class="gh-event-timer-list">`;
  html += `<div class="gh-event-timer-now">Current Time: <span>${formatTimeInTimeZone(now, selectedTimeZone)}</span></div>`;
  if (eventList.length === 0) {
    html += `<div class="gh-event-none">No upcoming events.</div>`;
  } else {
    eventList.forEach(ev => {
      html += `
      <div class="gh-event-item">
        <div class="gh-event-name">${ev.name || "Unnamed Event"}</div>
        <div class="gh-event-time">
          <span title="Local time">${formatShortTimeInTimeZone(ev.eventDate, selectedTimeZone)}</span>
          <span class="gh-event-time-utc" title="UTC time">${ev.eventDate.toISOString().substr(11,5)} UTC</span>
        </div>
        <div class="gh-event-countdown">Countdown: <span>${formatCountdown(ev.countdown)}</span></div>
        <div class="gh-event-waypoint-bar">
          <input type="text" class="gh-event-waypoint-input" value="${ev.waypoint || ""}" readonly id="gh-waypoint-input-${ev.idx}">
          <button class="gh-event-copy-btn" data-idx="${ev.idx}">Copy</button>
        </div>
      </div>
      `;
    });
  }
  html += `</div>`;
  container.insertAdjacentHTML('beforeend', html);

  // Copy event name and waypoint logic
  document.querySelectorAll('.gh-event-copy-btn').forEach(btn => {
    btn.onclick = function() {
      const idx = btn.getAttribute('data-idx');
      const event = eventList.find(e => e.idx.toString() === idx);
      if (!event) return;
      const textToCopy = `${event.name} - ${event.waypoint || ''}`.trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.classList.add('copied');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1200);
        });
      } else {
        // Fallback for older browsers
        const input = document.getElementById(`gh-waypoint-input-${idx}`);
        input.select();
        input.setSelectionRange(0, 99999);
        document.execCommand('copy');
        btn.classList.add('copied');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1200);
      }
    };
  });
}

function updateEvents() {
  fetch(EVENTS_URL)
    .then(res => res.json())
    .then(events => {
      renderEvents(events);
    });
}

// Initial load and live update
updateEvents();
setInterval(updateEvents, 1000);
