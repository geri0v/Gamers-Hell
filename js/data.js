const MANIFEST_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json';

export async function fetchAllData() {
  const manifest = await fetch(MANIFEST_URL).then(res => res.json());
  const urls = manifest.files.map(f =>
    f.startsWith('http') ? f : `https://geri0v.github.io/Gamers-Hell/json/${f}`
  );
  let all = [];
  for (let url of urls) {
    try {
      const json = await fetch(url).then(r => r.json());
      all.push(...flatten(json));
    } catch {}
  }
  return all;
}

function flatten(data) {
  const result = [];
  data.forEach(ex => {
    (ex.sources || []).forEach(src => {
      (src.events || []).forEach(e => {
        result.push({ ...e, expansion: ex.expansion, sourcename: src.sourceName });
      });
    });
  });
  return result;
}
