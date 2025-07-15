import { langMenuHTML, getCurrentLang, setCurrentLang } from "https://geri0v.github.io/Gamers-Hell/js/lang.js";

export function showModals(currentLang) {
  const app = document.getElementById("app");
  // Help Modal
  if (!document.getElementById("modal-help")) {
    const btn = document.createElement("button");
    btn.className = "side-btn";
    btn.id = "side-help";
    btn.textContent = "?";
    btn.style = "position:fixed;top:16px;left:16px;z-index:10002;";
    btn.onclick = () => {
      let modal = document.createElement("div");
      modal.id = "modal-help";
      Object.assign(modal.style, {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24,32,54,.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
      });
      modal.innerHTML = `
        <div style="background:#fff;border-radius:10px;padding:2em 2.7em 2em 2.7em;max-width:410px;text-align:left;">
          <h2 style="margin-top:0;font-size:1.2em">How to Use the Visualizer</h2>
          <ul style="margin:1em 0 1em 1em;color:#222;">
            <li><strong>Search:</strong> Type a map or event name.</li>
            <li><strong>Sort:</strong> Click any column header or use dropdown.</li>
            <li><strong>Toggle:</strong> Expand/collapse sections with Tab/Click/Enter.</li>
            <li><strong>Copy:</strong> Select the bar or press copy, get a nudge.</li>
            <li><strong>Deep linking:</strong> Use the 🔗 icon next to each event.</li>
            <li><strong>Mobile/Tablet:</strong> All features are touch-friendly.</li>
            <li><strong>Close:</strong> Click outside or press <kbd>Esc</kbd>.</li>
          </ul>
        </div>
      `;
      modal.tabIndex = -1;
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
      setTimeout(() => modal.focus(), 100);
      window.addEventListener('keydown', function escHelp(evt) {
        if (evt.key === 'Escape') { modal.remove(); window.removeEventListener('keydown', escHelp); }
      });
    };
    document.body.appendChild(btn);
  }

  // Language Modal
  if (!document.getElementById("modal-lang")) {
    const btn = document.createElement("button");
    btn.className = "side-btn";
    btn.id = "side-lang";
    btn.textContent = "🌐";
    btn.style = "position:fixed;top:16px;left:64px;z-index:10002;";
    btn.onclick = () => {
      let modal = document.createElement("div");
      modal.id = "modal-lang";
      Object.assign(modal.style, {
        position: 'fixed', top:0,left:0,right:0,bottom:0,background: 'rgba(24,32,54,.5)', display:'flex',alignItems:'center',justifyContent:'center',zIndex: 10001,
      });
      modal.innerHTML = `
        <div style="background:#fff;border-radius:10px;padding:1.5em 2em 1.5em 2em;min-width:270px;max-width:350px;text-align:center;">
          <div style="margin:0 0 0.7em 0;font-size:1.2em;">🌐 Select Language</div>
          <div>${langMenuHTML(currentLang)}</div>
          <div style="margin-top:1.6em;font-size:0.98em;color:#555">Reloads site in the chosen language (if supported by the GW2 API/wiki).</div>
        </div>
      `;
      modal.tabIndex = -1;
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      modal.querySelectorAll('button[data-lang]').forEach(btn => {
        btn.onclick = () => { setCurrentLang(btn.dataset.lang); };
      });
      document.body.appendChild(modal);
      setTimeout(() => modal.focus(), 100);
      window.addEventListener('keydown', function escLang(evt) {
        if (evt.key === 'Escape') { modal.remove(); window.removeEventListener('keydown', escLang);}
      });
    };
    document.body.appendChild(btn);
  }
}
