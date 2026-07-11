// "NP-0001 — Zumo de naranja" if the product has a code, else just the name
export function productLabel(p) {
  return p.code ? `${p.code} — ${p.name}` : p.name;
}
