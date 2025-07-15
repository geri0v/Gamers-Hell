// https://geri0v.github.io/Gamers-Hell/js/readme.js

export async function showReadmeModal() {
  if (document.getElementById('modal-readme')) return;
  let text = '';
  try {
    const res = await fetch('https://geri0v.github.io/Gamers-Hell/README.md');
    if (res.ok) text = await res.text();
    else text = '# README not found at remote URL.';
  } catch {
    text = '# Could not fetch README from remote URL.';
  }
  const modal = document.createElement('div');
  modal.id = "modal-readme";
  Object.assign(modal.style, {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(24,32,54,.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10001
  });
  modal.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:2em;max-width:500px;max-height:85vh;overflow-y:auto;text-align:left;">
      <h2 style="margin-top:0;">README</h2>
      <pre style="white-space:pre-wrap;margin:0;">${text.replace(/</g, "&lt;")}</pre>
    </div>
  `;
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
  modal.focus();
  window.addEventListener('keydown', function onEsc(evt) {
    if (evt.key === 'Escape') { modal.remove(); window.removeEventListener('keydown', onEsc); }
  });
}
