// time.js — Advanced GW2 Event Timer with Delegation, Filtering, Modal, and Accurate Timer

const EVENTS_URL = "https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/refs/heads/master/Events%20Module/ref/events.json";
const GW2_WIKI_BASE = "https://wiki.guildwars2.com/wiki/";

// Default timezone (persisted in localStorage if available)
let selectedTimeZone = localStorage.getItem('gh-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
const timeZones = [
  "Europe/Amsterdam",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney"
];

let allEvents = [];
let filteredEvents = [];
let nextEventIndex = -1;
let modal = null, modalContent = null, modalCloseBtn = null;

function pad(num) { return num.toString().padStart(2, '0'); }

function getEventDate(offset) {
  const [h, m] = offset.replace('Z', '').split(':').map(Number);
  const now = new Date();
  const eventDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  if (eventDate < now) eventDate.setUTCDate(eventDate.getUTCDate() + 1);
  return eventDate;
}

function getCountdown(eventDate) {
  const now = new Date();
  return Math.floor((eventDate - now) / 1000);
}

function formatCountdown(seconds) {
  if (seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatTimeInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timeZone
  }).format(date);
}

function formatShortTimeInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZone
  }).format(date);
}

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
    localStorage.setItem('gh-tz', selectedTimeZone);
    updateEvents();
  });

  container.appendChild(label);
  container.appendChild(select);
  return container;
}

function createCategoryFilter() {
  const container = document.createElement('div');
  container.id = 'category-filter-container';
  container.style.marginBottom = '12px';
  container.style.textAlign = 'center';
  container.style.color = 'var(--main-fg)';

  const label = document.createElement('label');
  label.htmlFor = 'category-filter-select';
  label.textContent = 'Filter by Category: ';
  label.style.marginRight = '8px';

  const select = document.createElement('select');
  select.id = 'category-filter-select';
  select.style.padding = '4px 8px';
  select.style.borderRadius = '4px';
  select.style.border = 'none';
  select.style.background = 'var(--input-bg)';
  select.style.color = 'var(--input-fg)';
  select.style.fontSize = '1em';

  const categories = new Set();
  allEvents.forEach(ev => {
    if (ev.category) categories.add(ev.category);
  });

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'All Categories';
  select.appendChild(defaultOption);

  Array.from(categories).sort().forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    const val = select.value;
    if (val === '') {
      filteredEvents = allEvents.slice();
    } else {
      filteredEvents = allEvents.filter(ev => ev.category === val);
    }
    renderEventsList(filteredEvents);
  });

  container.appendChild(label);
  container.appendChild(select);
  return container;
}

function renderEventsList(events) {
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

  nextEventIndex = eventList.length > 0 ? 0 : -1;

  let html = `<div class="gh-event-timer-list">`;
  html += `<div class="gh-event-timer-now">Current Time: <span>${formatTimeInTimeZone(now, selectedTimeZone)}</span></div>`;
  if (eventList.length === 0) {
    html += `<div class="gh-event-none">No upcoming events.</div>`;
  } else {
    eventList.forEach((ev, i) => {
      const highlightClass = (i === nextEventIndex) ? 'gh-event-next' : '';
      let wikiLink = '';
      if (ev.name) {
        const wikiName = encodeURIComponent(ev.name.replace(/ /g, '_'));
        wikiLink = `<a href="${GW2_WIKI_BASE}${wikiName}" target="_blank" rel="noopener noreferrer" class="gh-event-wiki-link" title="Open GW2 Wiki page">📖</a>`;
      }
      html += `
      <div class="gh-event-item ${highlightClass}" data-idx="${ev.idx}">
        <div class="gh-event-name">${ev.name || "Unnamed Event"} ${wikiLink}</div>
        <div class="gh-event-time">
          <span title="Local time">${formatShortTimeInTimeZone(ev.eventDate, selectedTimeZone)}</span>
          <span class="gh-event-time-utc" title="UTC time">${ev.eventDate.toISOString().substr(11,5)} UTC</span>
        </div>
        <div class="gh-event-countdown">Countdown: <span>${formatCountdown(ev.countdown)}</span></div>
        <div class="gh-event-waypoint-bar">
          <input type="text" class="gh-event-waypoint-input" value="${ev.waypoint || ""}" readonly id="gh-waypoint-input-${ev.idx}">
          <button class="gh-event-copy-btn" data-idx="${ev.idx}" aria-label="Copy event name and waypoint">Copy</button>
        </div>
      </div>
      `;
    });
  }
  html += `</div>`;

  const container = document.getElementById('gw2-event-timer');
  const oldList = container.querySelector('.gh-event-timer-list');
  if (oldList) oldList.remove();
  container.insertAdjacentHTML('beforeend', html);
}

function renderEvents(events) {
  const container = document.getElementById('gw2-event-timer');
  container.innerHTML = '';
  container.appendChild(createTimeZoneSelector());
  container.appendChild(createCategoryFilter());
  filteredEvents = events.slice();
  allEvents = events.slice();
  renderEventsList(filteredEvents);
}

function setupCopyDelegation() {
  const container = document.getElementById('gw2-event-timer');
  container.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('gh-event-copy-btn')) {
      const btn = e.target;
      const idx = btn.getAttribute('data-idx');
      const event = filteredEvents.find(ev => ev.idx.toString() === idx);
      if (!event) return;
      const textToCopy = `${event.name} - ${event.waypoint || ''}`.trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.classList.add('copied');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1200);
        });
      } else {
        const input = document.getElementById(`gh-waypoint-input-${idx}`);
        input.select();
        input.setSelectionRange(0, 99999);
        document.execCommand('copy');
        btn.classList.add('copied');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1200);
      }
    }
  });
}

function createModal() {
  modal = document.createElement('div');
  modal.id = 'gh-event-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '9999';
  modal.style.visibility = 'hidden';
  modal.style.opacity = '0';
  modal.style.transition = 'opacity 0.3s ease';

  modalContent = document.createElement('div');
  modalContent.style.background = 'var(--card-bg)';
  modalContent.style.color = 'var(--main-fg)';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '12px';
  modalContent.style.maxWidth = '90vw';
  modalContent.style.maxHeight = '80vh';
  modalContent.style.overflowY = 'auto';
  modalContent.style.fontFamily = 'Segoe UI, Arial, sans-serif';

  modalCloseBtn = document.createElement('button');
  modalCloseBtn.textContent = 'Close';
  modalCloseBtn.style.marginTop = '12px';
  modalCloseBtn.style.padding = '8px 16px';
  modalCloseBtn.style.border = 'none';
  modalCloseBtn.style.borderRadius = '6px';
  modalCloseBtn.style.background = 'var(--accent)';
  modalCloseBtn.style.color = '#fff';
  modalCloseBtn.style.cursor = 'pointer';
  modalCloseBtn.style.fontWeight = 'bold';

  modalCloseBtn.addEventListener('click', () => {
    hideModal();
  });

  modal.appendChild(modalContent);
  modal.appendChild(modalCloseBtn);
  document.body.appendChild(modal);
}

function showModal(contentHtml) {
  if (!modal) createModal();
  modalContent.innerHTML = contentHtml;
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
}

function hideModal() {
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      if (modal) modal.style.visibility = 'hidden';
    }, 300);
  }
}

function setupEventDetailsModal() {
  const container = document.getElementById('gw2-event-timer');
  container.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('gh-event-wiki-link')) {
      e.preventDefault();
      const eventDiv = e.target.closest('.gh-event-item');
      if (!eventDiv) return;
      const idx = eventDiv.getAttribute('data-idx');
      const event = filteredEvents.find(ev => ev.idx.toString() === idx);
      if (!event) return;

      let content = `<h2>${event.name}</h2>`;
      content += `<p><strong>Category:</strong> ${event.category || 'N/A'}</p>`;
      content += `<p><strong>Start Time:</strong> ${formatTimeInTimeZone(event.eventDate, selectedTimeZone)} (${selectedTimeZone})</p>`;
      content += `<p><strong>Waypoint:</strong> ${event.waypoint || 'N/A'}</p>`;
      content += `<p><a href="${GW2_WIKI_BASE}${encodeURIComponent(event.name.replace(/ /g, '_'))}" target="_blank" rel="noopener noreferrer">Open full wiki page</a></p>`;

      showModal(content);
    }
  });
}

// Advanced timer accuracy with recursive setTimeout
function startAccurateTimer() {
  function tick() {
    updateEvents();
    const now = Date.now();
    const delay = 1000 - (now % 1000);
    setTimeout(tick, delay);
  }
  tick();
}

function updateEvents() {
  fetch(EVENTS_URL)
    .then(res => res.json())
    .then(events => {
      allEvents = events.slice();
      filteredEvents = allEvents.slice();
      renderEvents(allEvents);
      setupCopyDelegation();
      setupEventDetailsModal();
    });
}

// Initial load and start timer
startAccurateTimer();
