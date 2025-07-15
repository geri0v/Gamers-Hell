window.showReadmeModal = async function() {
  if (document.getElementById('modal-readme')) return;
  let md = "";
  try {
    const res = await fetch('README.md');
    if(res.ok) md = await res.text();
  } catch { md = "# README could not be loaded."; }
  const m = document.createElement('div');
  m.id = "modal-readme";
  Object.assign(m.style, {
    position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(24,32,54,.75)',display:'flex',alignItems:'center',justifyContent:'center',
    zIndex: 10001
  });
  let html = '<div style="background:#fff;border-radius:10px;padding:2em;max-width:500px;max-height:85vh;overflow-y:auto;text-align:left;"><h2 style="margin-top:0;">README</h2><pre style="white-space:pre-wrap;">'+md.replace(/</g,"&lt;")+'</pre></div>';
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
