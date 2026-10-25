// Merch: the sums and questions behind the merch screens (no drawing here).
import { state, merchOf, events, bands, isMgmt } from './store.js';
import { todayISO, addDays } from './utils.js';

export const LOCS = [['van', 'Van box'], ['storage', 'Storage']];
export const LOC_NAME = { van: 'Van box', storage: 'Storage' };
export const KINDS = [['shirt', 'T-shirt'], ['hoodie', 'Hoodie'], ['vinyl', 'Vinyl'], ['cd', 'CD'], ['tote', 'Tote bag'], ['cap', 'Cap'], ['poster', 'Poster'], ['other', 'Other']];
export const KIND_NAME = Object.fromEntries(KINDS);
export const SIZE_PRESETS = { shirt: 'S, M, L, XL', hoodie: 'S, M, L, XL', vinyl: 'LP', cd: 'CD', tote: 'One size', cap: 'One size', poster: 'One size', other: 'One size' };
export const COLOURS = [
  ['Black', '#17181B'], ['White', '#EDEBE6'], ['Grey', '#7D8189'], ['Navy', '#1F2A44'], ['Red', '#B3261E'],
  ['Green', '#2F5D3A'], ['Yellow', '#F5C542'], ['Pink', '#E46AA8'], ['Beige', '#D9CBB0'], ['Blue', '#3B6FD8']
];

export const eur = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return '€' + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
export const parseEur = (s) => {
  const v = parseFloat(String(s || '').replace(/[€\s]/g, '').replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0;
};
export const parseSizes = (s) => Array.from(new Set(String(s || '').split(/[,;/]+/).map((x) => x.trim().slice(0, 12)).filter(Boolean))).slice(0, 12);

// ---------- Which band the merch screens show ----------
export function merchBand() {
  if (bands.some((b) => b.id === state.view)) return state.view;
  if (bands.some((b) => b.id === state.merchBand)) return state.merchBand;
  return bands[0] ? bands[0].id : null;
}

// ---------- Products ----------
export function products(bandId) {
  const costs = Object.fromEntries(merchOf(bandId, 'costs').map((c) => [c.id, c.cost]));
  return merchOf(bandId, 'products').map((p) => ({
    ...p,
    band: bandId,
    sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['One size'],
    colours: Array.isArray(p.colours) && p.colours.length ? p.colours : [{ id: 'c1', name: '', hex: '#7D8189' }],
    stock: p.stock || {},
    price: Number(p.price) || 0,
    lowAt: Number.isFinite(Number(p.lowAt)) ? Number(p.lowAt) : 2,
    cost: costs[p.id] != null ? Number(costs[p.id]) : null
  })).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.name || '').localeCompare(b.name || ''));
}
export const productById = (bandId, pid) => products(bandId).find((p) => p.id === pid);

export function photo(bandId, pid, cid) {
  const hit = merchOf(bandId, 'photos').find((x) => x.id === `${pid}_${cid}`);
  return hit ? hit.data : null;
}

export const count = (p, cid, loc, size) => Math.max(0, Number((((p.stock || {})[cid] || {})[loc] || {})[size]) || 0);
// loc: 'van' | 'storage' | 'all'
export function stockAt(p, cid, size, loc) {
  if (loc === 'all') return count(p, cid, 'van', size) + count(p, cid, 'storage', size);
  return count(p, cid, loc, size);
}
export const totalOf = (p, cid, loc) => p.sizes.reduce((s, z) => s + stockAt(p, cid, z, loc), 0);

// One line per product + colour ("Fragments shirt · Black")
export function lines(bandId) {
  return products(bandId).flatMap((p) => p.colours.map((c) => ({ p, c, key: `${p.id}_${c.id}`, label: p.name + (p.colours.length > 1 && c.name ? ' · ' + c.name : '') })));
}

export const sizeLabel = (p, size) => (p.sizes.length > 1 ? size : '');

// ---------- Bundles ("Shirt + Vinyl for €50") ----------
export function bundles(bandId) {
  return merchOf(bandId, 'bundles').map((b) => ({ ...b, items: Array.isArray(b.items) ? b.items : [], price: Number(b.price) || 0 }))
    .filter((b) => b.items.length >= 2);
}
// How much the bundles take off this cart (each bundle as often as it fits)
export function bundleDiscount(bandId, cart) {
  let left = cart.map((c) => ({ ...c }));
  const used = [];
  let discount = 0;
  bundles(bandId).forEach((b) => {
    for (;;) {
      const picked = [];
      const ok = b.items.every((pid) => {
        const i = left.findIndex((c, k) => c.pid === pid && !picked.includes(k));
        if (i < 0) return false;
        picked.push(i);
        return true;
      });
      if (!ok) break;
      const full = picked.reduce((s, i) => s + left[i].price, 0);
      const off = Math.max(0, full - b.price);
      if (off <= 0) break;
      discount += off;
      used.push({ name: b.name, off });
      left = left.filter((_, i) => !picked.includes(i));
    }
  });
  return { discount: Math.round(discount * 100) / 100, used };
}

// ---------- Show nights ----------
// A night is a show (eventId) or, without a show, a day ("d-2026-11-27").
export const nightKeyOf = (sale) => sale.night || (sale.eventId ? sale.eventId : 'd-' + sale.date);

export function salesOf(bandId) {
  return merchOf(bandId, 'sales').map((s) => ({ ...s, items: Array.isArray(s.items) ? s.items : [], total: Number(s.total) || 0, discount: Number(s.discount) || 0 }))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}
export const nightSales = (bandId, key) => salesOf(bandId).filter((s) => nightKeyOf(s) === key);
export const nightDoc = (bandId, key) => merchOf(bandId, 'nights').find((n) => n.id === key) || {};

// Shows the merch table could be for right now (a show night runs past midnight)
export function sellOptions(bandId) {
  const now = new Date();
  const today = todayISO();
  const from = addDays(today, now.getHours() < 6 ? -1 : 0);
  const shows = events.filter((e) => e.band === bandId && e.type === 'show' && !e.suggested && e.date >= addDays(today, -7) && e.date <= addDays(today, 1))
    .sort((a, b) => a.date.localeCompare(b.date));
  const tonight = shows.filter((e) => e.date === from || e.date === today).pop() || null;
  return { shows, tonight, today };
}

export function nightTitle(bandId, key) {
  if (key.startsWith('d-')) return { date: key.slice(2), place: 'No show', event: null };
  const e = events.find((x) => x.id === key);
  return e ? { date: e.date, place: e.place || e.title || 'Show', event: e } : { date: '', place: 'Show (deleted)', event: null };
}

// All nights with sales, newest first
export function nights(bandId) {
  const keys = {};
  salesOf(bandId).forEach((s) => { const k = nightKeyOf(s); (keys[k] = keys[k] || []).push(s); });
  merchOf(bandId, 'nights').forEach((n) => { keys[n.id] = keys[n.id] || []; });
  return Object.entries(keys).map(([key, list]) => ({ key, ...nightTitle(bandId, key), ...summary(bandId, list), doc: nightDoc(bandId, key) }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function summary(bandId, list) {
  const prods = Object.fromEntries(products(bandId).map((p) => [p.id, p]));
  let total = 0; let cash = 0; let card = 0; let items = 0; let cost = 0; let costKnown = true;
  const best = {}; const sizes = {};
  list.forEach((s) => {
    total += s.total;
    if (s.pay === 'cash') cash += s.total; else card += s.total;
    s.items.forEach((it) => {
      items += 1;
      const p = prods[it.pid];
      if (p && p.cost != null) cost += p.cost; else costKnown = false;
      const k = `${it.pid}_${it.cid}`;
      const b = (best[k] = best[k] || { name: it.name + (it.colour ? ' · ' + it.colour : ''), n: 0, eur: 0 });
      b.n += 1; b.eur += Number(it.price) || 0;
      if (it.size && p && p.sizes.length > 1) sizes[it.size] = (sizes[it.size] || 0) + 1;
    });
  });
  return {
    total, cash, card, items, count: list.length,
    profit: costKnown ? total - cost : null,
    best: Object.values(best).sort((a, b) => b.n - a.n || b.eur - a.eur),
    sizes, list
  };
}

// "Before the next show": what to move from storage to the van box, what's gone
export function refillHints(bandId) {
  const moves = []; const soldOut = []; const low = [];
  products(bandId).forEach((p) => p.colours.forEach((c) => {
    const label = p.name + (p.colours.length > 1 && c.name ? ' · ' + c.name : '');
    const sized = p.sizes.length > 1;
    const out = []; const lowHere = [];
    p.sizes.forEach((z) => {
      const van = count(p, c.id, 'van', z);
      const store = count(p, c.id, 'storage', z);
      if (van + store === 0) { out.push(z); return; }
      if (van <= p.lowAt && store > 0) {
        const n = Math.min(store, Math.max(1, p.lowAt + 3 - van));
        moves.push({ pid: p.id, cid: c.id, size: z, n, name: label + (sized ? ' ' + z : '') });
      } else if (van <= p.lowAt) lowHere.push(sized ? `${z}: ${van}` : `${van}`);
    });
    if (out.length) soldOut.push(label + (sized ? ' ' + out.join(', ') : ''));
    if (lowHere.length) low.push(`${label}: ${lowHere.join(', ')} left`);
  }));
  return { moves, soldOut, low };
}

export function stockWarnings(bandId) {
  const out = [];
  products(bandId).forEach((p) => p.colours.forEach((c) => p.sizes.forEach((z) => {
    const n = stockAt(p, c.id, z, 'all');
    const name = p.name + (p.colours.length > 1 && c.name ? ' ' + c.name.toLowerCase() : '') + (p.sizes.length > 1 ? ' ' + z : '');
    if (n === 0) out.push({ level: 'out', text: `${name} sold out` });
    else if (n <= p.lowAt) out.push({ level: 'low', text: `${name}: ${n} left` });
  })));
  return out;
}

export const canEditMerch = (bandId) => isMgmt(bandId);
