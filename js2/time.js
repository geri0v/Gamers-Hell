// time.js — GW2 Event Timer (Blish HUD events.json)
const EVENTS_URL = "https://raw.githubusercontent.com/blish-hud/Community-Module-Pack/refs/heads/master/Events%20Module/ref/events.json";

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

function renderEvents(events) {
  const now = new Date();
  const eventList = events.filter(ev => ev.offset).map(ev => {
    const eventDate = getEventDate(ev.offset);
    return {
      ...ev,
      eventDate,
      countdown: getCountdown(eventDate)
    };
  }).filter(ev => ev.countdown >= 0)
    .sort((a, b) => a.countdown - b.countdown);

  let html = `<div class="gw2-event-timer-list">`;
  html += `<div class="gw2-event-timer-now">Current Time: <span>${now.toLocaleTimeString()}</span></div>`;
  if (eventList.length === 0) {
    html += `<div class="gw2-event-none">No upcoming events.</div>`;
  } else {
    eventList.forEach((ev, idx) => {
      html += `
      <div class="gw2-event-item">
        <div class="gw2-event-name">${ev.name || "Unnamed Event"}</div>
        <div class="gw2-event-time">Starts: <span>${ev.eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span></div>
        <div class="gw2-event-countdown">Countdown: <span>${formatCountdown(ev.countdown)}</span></div>
        <div class="gw2-event-waypoint">
          <input type="text" class="gw2-event-waypoint-input" value="${ev.waypoint || ""}" readonly id="waypoint-input-${idx}">
          <button class="gw2-event-copy-btn" data-input="waypoint-input-${idx}">Copy</button>
        </div>
      </div>
      `;
    });
  }
  html += `</div>`;
  document.getElementById('gw2-event-timer').innerHTML = html;

  // Copy waypoint logic (modern clipboard API fallback)
  document.querySelectorAll('.gw2-event-copy-btn').forEach(btn => {
    btn.onclick = function() {
      const inputId = btn.getAttribute('data-input');
      const input = document.getElementById(inputId);
      input.select();
      input.setSelectionRange(0, 99999); // For mobile
      try {
        document.execCommand('copy');
      } catch {
        navigator.clipboard.writeText(input.value);
      }
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1000);
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
