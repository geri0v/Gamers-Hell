// js/terminal.js
// Renders a loading terminal overlay: info, errors, status, progress, and success

let terminalElem = null;
let logBuffer = [];
let hidden = false;
let progressDiv = null;

// Begin een nieuwe terminalsessie (leeg alles, toon bovenaan)
export function startTerminal() {
  if (!terminalElem) {
    terminalElem = document.createElement('div');
    terminalElem.id = 'terminal';
    document.body.prepend(terminalElem);
  }
  logBuffer = [];
  hidden = false;
  terminalElem.className = '';
  terminalElem.innerHTML = '';
  progressDiv = null;
  showTerminal();
}

// Einde van de load; verberg automatisch na een korte timeout
export function endTerminal(success = true) {
  if (terminalElem) {
    setTimeout(() => {
      terminalElem.className = 'hidden';
      hidden = true;
    }, 2000);
  }
}

// Voeg een logregel toe (type: info/progress/warn/error/success)
export function appendTerminal(msg, type = 'info') {
  if (!terminalElem) startTerminal();
  // Voeg gewone info toe boven progressbar
  const div = document.createElement('div');
  div.className = 'terminal-line terminal-' + type;
  div.textContent = msg;
  terminalElem.appendChild(div);
  // Progress onderaan houden
  if (progressDiv) terminalElem.appendChild(progressDiv);
  terminalElem.scrollTop = terminalElem.scrollHeight;
  logBuffer.push({ msg, type });
}

// Progressbalk/status: altijd als onderste lijn, maximaal 1
export function updateTerminalProgress(percent, message) {
  if (!terminalElem) startTerminal();
  if (!progressDiv) {
    progressDiv = document.createElement('div');
    progressDiv.className = 'terminal-line terminal-progress';
  }
  progressDiv.textContent = (message || 'Progress') + (typeof percent === 'number' ? ` (${percent}%)` : '');
  // (Optioneel: visueel balkje)
  progressDiv.style.background = `linear-gradient(to right,#4dabf7 ${(percent||0)}%,transparent ${(percent||0)}%)`;
  if (!terminalElem.contains(progressDiv)) terminalElem.appendChild(progressDiv);
  terminalElem.scrollTop = terminalElem.scrollHeight;
}

// Toon terminal (onzichtbaar maken = class 'hidden')
export function showTerminal() {
  if (terminalElem) {
    terminalElem.className = '';
    hidden = false;
  }
}
export function hideTerminal() {
  if (terminalElem) {
    terminalElem.className = 'hidden';
    hidden = true;
  }
}

// Sneltoets (Shift+T) voor live tonen/verbergen
window.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
    hidden ? showTerminal() : hideTerminal();
  }
});

// (Optional: later uitbreiding om logs op te slaan/terug te kijken)
