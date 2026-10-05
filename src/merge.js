// Pure merge logic for syncing an inventory between devices.
// Every item carries `u` (last-modified, ms). Deletions leave a tombstone
// {id, u} so a stale device can't resurrect a removed item.

const TOMB_TTL = 30 * 864e5;

export function mergeData(local, remote, now = Date.now()) {
  const L = normalize(local), R = normalize(remote);

  // tombstones: keep the newest per id, drop old ones
  const tombs = new Map();
  for (const t of [...L.tomb, ...R.tomb]) {
    const prev = tombs.get(t.id);
    if (!prev || t.u > prev.u) tombs.set(t.id, t);
  }

  const byId = new Map();
  for (const it of [...R.items, ...L.items]) {
    const prev = byId.get(it.id);
    if (!prev || (it.u || 0) >= (prev.u || 0)) byId.set(it.id, it);
  }

  const items = [];
  for (const it of byId.values()) {
    const t = tombs.get(it.id);
    if (t && t.u >= (it.u || 0)) continue;     // deleted after last edit
    items.push(it);
  }

  const tomb = [...tombs.values()].filter(t => now - t.u < TOMB_TTL);

  // Shopping list is small; newest whole list wins.
  const useLocalShop = L.shopU >= R.shopU;
  return {
    items,
    shop:  useLocalShop ? L.shop  : R.shop,
    shopU: useLocalShop ? L.shopU : R.shopU,
    tomb,
  };
}

export function normalize(d) {
  return {
    items: Array.isArray(d?.items) ? d.items : [],
    shop:  Array.isArray(d?.shop)  ? d.shop  : [],
    tomb:  Array.isArray(d?.tomb)  ? d.tomb  : [],
    shopU: Number(d?.shopU) || 0,
  };
}

export function sameData(a, b) {
  const A = normalize(a), B = normalize(b);
  return JSON.stringify([A.items, A.shop, A.tomb]) === JSON.stringify([B.items, B.shop, B.tomb]);
}
