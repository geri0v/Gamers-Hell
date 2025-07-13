const EVENTS_URL = "https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/refs/heads/master/Events%20Module/ref/events.json";

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

  let html = `<div class="gh-event-timer-list">`;
  html += `<div class="gh-event-timer-now">Current Time: <span>${now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</span></div>`;
  if (eventList.length === 0) {
    html += `<div class="gh-event-none">No upcoming events.</div>`;
  } else {
    eventList.forEach(ev => {
      html += `
      <div class="gh-event-item">
        <div class="gh-event-name">${ev.name || "Unnamed Event"}</div>
        <div class="gh-event-time">
          <span title="Local time">${ev.eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="gh-event-time-utc" title="UTC time">${ev.eventDate.toISOString().substr(11,5)} UTC</span>
        </div>
        <div class="gh-event-countdown">Countdown: <span>${formatCountdown(ev.countdown)}</span></div>
        <div class="gh-event-waypoint-bar">
          <input type="text" class="gh-event-waypoint-input" value="${ev.waypoint || ""}" readonly id="gh-waypoint-input-${ev.idx}">
          <button class="gh-event-copy-btn" data-input="gh-waypoint-input-${ev.idx}">Copy</button>
        </div>
      </div>
      `;
    });
  }
  html += `</div>`;
  document.getElementById('gw2-event-timer').innerHTML = html;

  // Copy waypoint logic
  document.querySelectorAll('.gh-event-copy-btn').forEach(btn => {
    btn.onclick = function() {
      const inputId = btn.getAttribute('data-input');
      const input = document.getElementById(inputId);
      input.select();
      input.setSelectionRange(0, 99999); // For mobile
      // Try modern clipboard API first
      if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(() => {
          btn.classList.add('copied');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1200);
        });
      } else {
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

updateEvents();
setInterval(updateEvents, 1000);
