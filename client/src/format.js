// "NP-0001 — Zumo de naranja" if the product has a code, else just the name
export function productLabel(p) {
  return p.code ? `${p.code} — ${p.name}` : p.name;
}

// Stable accent color per product, derived from its name
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#0d9488', '#d97706', '#db2777', '#0284c7', '#65a30d', '#dc2626'];
export function productColor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
