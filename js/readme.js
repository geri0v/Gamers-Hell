window.showReadmeModal = async function() {
  if (document.getElementById('modal-readme')) return;
  let md = "";
  try {
    const res = await fetch('README.md');
    if(res.ok) md = await res.text();
    else md = "# README.md not found.";
  } catch { md = "# README could not be loaded."; }

  // Basic markdown to HTML - minimal for readability, can be replaced with a markdown lib
  let htmlContent = md
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap list items in <ul>
  htmlContent = htmlContent.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  htmlContent = htmlContent.replace(/<\/ul>\s*<ul>/g, '');

  const m = document.createElement('div');
  m.id = "modal-readme";
  Object.assign(m.style, {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(24,32,54,.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001
  });
  let html = `
    <div style="background:#fff;border-radius:10px;padding:2em;max-width:600px;max-height:85vh;overflow-y:auto;text-align:left;box-shadow:0 4px 32px #0004;">
      <button aria-label="Close" style="float:right;font-size:1.1em;padding:0.3em 1em;border:none;background:#eee;border-radius:4px;cursor:pointer;" onclick="modal-readme.remove()">Close</button>
      <h2 style="margin-top:0;">README</h2>
      <div style="font-size:1.06em;line-height:1.5;">
        ${htmlContent}
      </div>
    </div>
  `;
  m.innerHTML = html;
  m.onclick = e => { if(e.target === m) m.remove(); };
  document.body.appendChild(m);
  m.focus();
  window.addEventListener('keydown', function onEsc(evt) {
    if(evt.key === 'Escape'){m.remove();window.removeEventListener('keydown',onEsc);}
  });
};

document.addEventListener('DOMContentLoaded', ()=>{
  document.body.addEventListener('click',e=>{
    if(e.target && e.target.id==='side-readme') showReadmeModal();
  });
});
