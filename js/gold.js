// gold.js
export function formatCopper(copper) {
  if (copper === null || isNaN(copper)) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;

  const parts = [];
  if (g > 0) parts.push(`${g}g`);
  if (s > 0) parts.push(`${s}s`);
  if (parts.length === 0 || c > 0) parts.push(`${c}c`);
  return parts.join(' ');
}
