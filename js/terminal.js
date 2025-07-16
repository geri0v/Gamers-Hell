// terminal.js
export function appendTerminal(message, type = 'info') {
  const terminal = document.querySelector('#terminal');
  if (!terminal) return;

  const line = document.createElement('pre');
  line.className = `terminal-line terminal-${type}`;
  line.textContent = message;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

export function startTerminal() {
  const terminal = document.querySelector('#terminal');
  if (!terminal) return;
  terminal.innerHTML = ''; // clear old output
  terminal.classList.remove('hidden');
  terminal.classList.add('matrix-mode');
  appendTerminal('🔄 Initializing Guild Wars 2 Event App...', 'info');
}

export function endTerminal(success = true) {
  const terminal = document.querySelector('#terminal');
  if (!terminal) return;

  terminal.classList.remove('matrix-mode');

  if (success && !terminal.querySelector('.terminal-error')) {
    setTimeout(() => terminal.classList.add('hidden'), 2000);
  }
}
