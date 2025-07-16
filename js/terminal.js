// terminal.js
// Renders a loading terminal overlay: info, errors, status, and success

let terminalElem = null;
let logBuffer = [];
let hidden = false;

export function startTerminal() {
  if (!terminalElem) {
    terminalElem = document.createElement('div');
    terminalElem.id = 'terminal';
    document.body.prepend(terminalElem);
  }
  logBuffer = [];
  hidden = false;
  terminalElem.className = '';
  terminalElem.innerHTML = ''; // Clear log
  showTerminal();
}

export function endTerminal(success = true) {
  if (terminalElem) {
    setTimeout(() => {
      terminalElem.className = 'hidden';
      hidden = true;
    }, 2000); // Auto-hide after 2s
  }
}

export function appendTerminal(msg, type = 'info') {
  if (!terminalElem) startTerminal();
  const div = document.createElement('div');
  div.className = 'terminal-line terminal-' + type;
  div.textContent = msg;
  terminalElem.appendChild(div);
  terminalElem.scrollTop = terminalElem.scrollHeight;
  logBuffer.push({ msg, type });
}

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

// Optional: Hold Shift+T to reveal/hide the terminal at any time
window.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
    hidden ? showTerminal() : hideTerminal();
  }
});

/* Example usage in visual.js:
startTerminal();
appendTerminal('⏳ Loading event data...', 'progress');
appendTerminal('✓ Loot data fetched!', 'success');
appendTerminal('No loot found!', 'error');
endTerminal();
*/
