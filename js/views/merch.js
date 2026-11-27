// MERCH — stock, selling at the merch table, show-night reports, products & bundles.
import { state, bands, bandById, me, isMgmt } from '../store.js';
import { topBar } from '../components.js';
import { icons } from '../icons.js';
import { esc, fmtDay, fmtDayLong } from '../utils.js';
import {
  LOCS, LOC_NAME, KINDS, SIZE_PRESETS, COLOURS, eur, merchBand, products, productById, photo, count, stockAt, totalOf, lines,
  bundles, bundleDiscount, parseSizes, cartLines, colourHex, productLog, LOG_TYPES, nightKeyOf, salesOf, nightSales, nightDoc, sellOptions, nightTitle, nights, summary, refillHints, stockWarnings
} from '../merch.js';
import { kb } from '../photo.js';

// ---------- Small pictures when there's no photo yet ----------
function isLight(hex) {
  const h = String(hex || '#777').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16) || 0;
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150;
}
export function art(kind, hex, cls = '') {
  const f = esc(hex || '#7D8189');
  const pr = isLight(hex) ? '#17181B' : '#E9E6DF';
  const shapes = {
    shirt: `<path d="M34 18l12-6h8c1 5 5 8 10 8s9-3 10-8h8l12 6 10 16-14 7-5-5v52H43V36l-5 5-14-7z" fill="${f}" stroke="#00000033"/><rect x="50" y="42" width="28" height="16" rx="2" fill="${pr}" opacity=".85"/>`,
    hoodie: `<path d="M36 22l14-8c3 8 8 12 14 12s11-4 14-12l14 8 12 22-12 6-6-6v48H42V44l-6 6-12-6z" fill="${f}" stroke="#00000033"/><path d="M52 14c2 10 6 16 12 16s10-6 12-16" fill="none" stroke="${pr}" stroke-width="2" opacity=".6"/><rect x="50" y="70" width="28" height="12" rx="3" fill="#00000030"/>`,
    vinyl: `<rect x="22" y="18" width="64" height="64" rx="2" fill="#30333A"/><circle cx="72" cy="50" r="30" fill="${f}" stroke="#00000055"/><circle cx="72" cy="50" r="18" fill="none" stroke="#ffffff18"/><circle cx="72" cy="50" r="7" fill="${pr}"/>`,
    cd: `<rect x="26" y="22" width="56" height="56" rx="3" fill="${f}" stroke="#00000044"/><circle cx="54" cy="50" r="20" fill="#C9CCD2" opacity=".85"/><circle cx="54" cy="50" r="5" fill="${f}"/>`,
    tote: `<path d="M44 34c0-14 6-20 20-20s20 6 20 20" fill="none" stroke="${f}" stroke-width="5"/><path d="M30 34h68l-6 54H36z" fill="${f}" stroke="#00000033"/><rect x="50" y="52" width="28" height="14" rx="2" fill="${pr}" opacity=".8"/>`,
    socks: `<path d="M40 12h22v40l14 14c6 6 6 14 0 20s-14 6-20 0L40 70z" fill="${f}" stroke="#00000033"/><rect x="40" y="12" width="22" height="8" fill="${pr}" opacity=".7"/><path d="M66 18h22v40l14 14c6 6 6 14 0 20s-14 6-20 0L66 76z" fill="${f}" stroke="#00000033" opacity=".75"/><rect x="66" y="18" width="22" height="8" fill="${pr}" opacity=".5"/>`,
    cap: `<path d="M30 62c0-22 15-36 34-36s34 14 34 36z" fill="${f}" stroke="#00000033"/><path d="M60 62h48c0 6-8 10-20 10H60z" fill="${f}" stroke="#00000044"/><circle cx="64" cy="26" r="3" fill="${pr}"/>`,
    poster: `<rect x="34" y="14" width="60" height="76" rx="2" fill="${f}" stroke="#00000033"/><rect x="42" y="24" width="44" height="34" fill="${pr}" opacity=".7"/><rect x="42" y="64" width="30" height="5" fill="${pr}" opacity=".6"/><rect x="42" y="73" width="40" height="4" fill="${pr}" opacity=".4"/>`,
    other: `<rect x="30" y="26" width="68" height="52" rx="8" fill="${f}" stroke="#00000033"/><path d="M30 40h68" stroke="${pr}" opacity=".5"/>`
  };
  return `<svg class="art ${cls}" viewBox="0 0 128 100" aria-hidden="true">${shapes[kind] || shapes.other}</svg>`;
}
const pic = (bandId, p, c, cls = '') => {
  const src = photo(bandId, p.id);
  return src ? `<img class="pic ${cls}" src="${src}" alt="">` : `<span class="pic ${cls}" style="background:#2C2F35">${art(p.kind, c.hex)}</span>`;
};

// ---------- Header with Stock / Sell / Nights ----------
function head(active, bandId, title) {
  const tabs = [['money', 'Stock'], ['merch/sell', 'Sell'], ['merch/nights', 'Nights']];
  const pick = (state.view === 'me' || state.view === 'all') && bands.length > 1
    ? `<div class="chips" role="group" aria-label="Band">${bands.map((b) => `<button type="button" class="chip ${b.id === bandId ? 'on' : ''}" data-action="merch-band" data-band="${esc(b.id)}" aria-pressed="${b.id === bandId}"><span class="dot" style="background:${esc(b.color)}" aria-hidden="true"></span>${esc(b.name)}</button>`).join('')}</div>` : '';
  return `<header class="head merch-head">
      ${topBar()}
      <div class="title-row"><h1>${esc(title)}</h1></div>
      ${pick}
      <nav class="seg merch-tabs" aria-label="Merch">${tabs.map(([h, l]) => `<a href="#/${h}" class="${active === h ? 'on' : ''}" ${active === h ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    </header>`;
}

// ---------- STOCK ----------
export function renderStock() {
  const bandId = merchBand();
  if (!bandId) return head('money', null, 'Merch') + '<main id="main"><div class="empty">Join or create a band first.</div></main>';
  const mgmt = isMgmt(bandId);
  const loc = state.stockLoc || 'all';
  const ps = products(bandId);
  const pTotal = (p, where) => p.colours.reduce((t, c) => t + totalOf(p, c.id, where), 0);
  const total = ps.reduce((t, p) => t + pTotal(p, loc), 0);
  const live = ps.filter((p) => pTotal(p, 'all') > 0);
  const gone = ps.filter((p) => pTotal(p, 'all') === 0);
  const tone = (n, p) => (n <= 0 ? 'out' : n <= p.lowAt ? 'low' : '');
  const open = state.stockOpen || {};
  const sizeChips = (p, c) => p.sizes.map((z) => {
    const n = stockAt(p, c.id, z, loc);
    return `<span class="size-chip ${tone(n, p)}">${p.sizes.length > 1 ? `<b>${esc(z)}</b> ` : ''}${n === 0 ? 'sold out' : n}</span>`;
  }).join('');

  // Low-stock line: one short note per product instead of every single size
  const warnParts = live.map((p) => {
    let low = 0; let out = 0;
    p.colours.forEach((c) => p.sizes.forEach((z) => { const n = stockAt(p, c.id, z, 'all'); if (n === 0) out += 1; else if (n <= p.lowAt) low += 1; }));
    const bits = [low ? `${low} low` : '', out ? `${out} sold out` : ''].filter(Boolean);
    return bits.length ? `${p.name}: ${bits.join(', ')}` : '';
  }).filter(Boolean);

  const card = (p) => {
    const n = pTotal(p, loc);
    const isOpen = open.pid === p.id;
    const sel = p.colours.find((c) => c.id === open.cid) || null;
    const withPhoto = [...p.colours].sort((x, y) => totalOf(p, y.id, 'all') - totalOf(p, x.id, 'all'))[0];
    const sub = p.colours.length > 1 ? `${eur(p.price)} · ${p.colours.length} colours` : [eur(p.price), p.colours[0].name].filter(Boolean).join(' · ');
    const one = p.colours.length === 1;
    const detail = !isOpen ? '' : `<div class="stock-detail">
        ${one ? `<div class="size-chips">${sizeChips(p, p.colours[0])}</div>` : `
        <div class="colour-chips" role="group" aria-label="Colours of ${esc(p.name)}">${p.colours.map((c) => {
          const k = totalOf(p, c.id, loc);
          return `<button type="button" class="colour-chip ${sel && sel.id === c.id ? 'on' : ''}" data-action="stock-colour" data-pid="${esc(p.id)}" data-cid="${esc(c.id)}" aria-pressed="${!!(sel && sel.id === c.id)}"><i style="background:${esc(c.hex)}" aria-hidden="true"></i><span class="cname">${esc(c.name || 'Colour')}</span><span class="n ${k === 0 ? 'zero' : ''}">${k}</span></button>`;
        }).join('')}</div>
        ${sel ? `<div class="size-chips">${sizeChips(p, sel)}</div>` : '<p class="muted small">Tap a colour to see its sizes.</p>'}`}
        ${mgmt ? `<a class="btn-small edit-link" href="#/merch/product/${esc(p.id)}">Edit product</a>` : ''}
      </div>`;
    return `<div class="prod-card group ${isOpen ? 'open' : ''}">
      <button type="button" class="prod-head" data-action="stock-open" data-pid="${esc(p.id)}" aria-expanded="${isOpen}">
        ${pic(bandId, p, withPhoto)}
        <span class="prod-info">
          <span class="prod-name">${esc(p.name || 'Product')}</span>
          <span class="muted small">${esc(sub)}</span>
          ${one ? '' : `<span class="dots" aria-hidden="true">${p.colours.map((c) => `<i style="background:${esc(c.hex)}"></i>`).join('')}</span>`}
        </span>
        <span class="prod-total"><b>${n}</b><span class="muted small">${loc === 'all' ? 'total' : LOC_NAME[loc].toLowerCase()}</span></span>
      </button>
      ${detail}
    </div>`;
  };
  const cards = live.map(card).join('');
  const soldOpen = !!state.soldOpen;
  const soldHtml = gone.length ? `<button type="button" class="sold-head" data-action="sold-toggle" aria-expanded="${soldOpen}">
      <span class="sold-label">SOLD OUT</span><span class="sold-count">${gone.length}</span>
      <span class="grow muted small">${esc(gone.map((p) => p.name).join(', '))}</span>${icons.chevronRight(18)}</button>
    ${soldOpen ? `<div class="prod-grid">${gone.map((p) => `<div class="prod-card gone">
        ${pic(bandId, p, p.colours[0])}
        <span class="prod-info"><span class="prod-name">${esc(p.name)}</span><span class="muted small">${esc(p.colours.length > 1 ? `${eur(p.price)} · ${p.colours.length} colours` : eur(p.price))} · every size gone</span></span>
        ${mgmt ? `<a class="btn-small" href="#/merch/product/${esc(p.id)}">+ Restock</a>` : ''}
      </div>`).join('')}</div>` : ''}` : '';

  const bl = bundles(bandId);
  const names = Object.fromEntries(products(bandId).map((p) => [p.id, p]));
  const bundleRows = bl.map((b) => {
    const full = b.items.reduce((s, pid) => s + ((names[pid] || {}).price || 0), 0);
    const body = `<span class="stack-2 grow"><span class="person-name">${esc(b.name || b.items.map((pid) => (names[pid] || {}).name || '?').join(' + '))}</span>
      ${b.name && b.name !== b.items.map((pid) => (names[pid] || {}).name || '?').join(' + ') ? `<span class="muted small">${esc(b.items.map((pid) => (names[pid] || {}).name || '?').join(' + '))}</span>` : ''}</span>
      <span class="bundle-price"><s class="muted">${eur(full)}</s> <b>${eur(b.price)}</b></span>`;
    return mgmt ? `<a class="person" href="#/merch/bundle/${esc(b.id)}">${body}</a>` : `<div class="person">${body}</div>`;
  }).join('');

  return head('money', bandId, 'Merch') + `<main id="main" class="merch-main">
    <div class="row-inline wrap">
      <div class="seg" role="group" aria-label="Where">${[['all', 'All'], ...LOCS].map(([k, l]) => `<button type="button" class="${loc === k ? 'on' : ''}" data-action="stock-loc" data-loc="${k}" aria-pressed="${loc === k}">${l}</button>`).join('')}</div>
      <span class="muted small grow right">${total} items</span>
    </div>
    ${warnParts.length ? `<div class="warning small-warning merch-warn">${icons.warn(16)}<span><b>Low stock</b> · ${esc(warnParts.slice(0, 3).join(' · '))}${warnParts.length > 3 ? ` · +${warnParts.length - 3} more` : ''}</span></div>` : ''}
    ${ps.length ? `<div class="prod-grid">${cards}</div>${soldHtml}` : `<div class="empty">${mgmt ? 'No merch yet. Add your first product: take a photo, set the sizes and how many you have.' : 'No merch yet. MGMT can add products here.'}</div>`}
    ${mgmt ? `<a class="btn-outline" href="#/merch/product/new">${icons.plus()} Add product</a>` : ''}
    <h2 class="section-h">Bundles</h2>
    ${bundleRows || `<div class="empty">${mgmt ? 'e.g. shirt + vinyl for €50. Applied automatically when both are in the cart.' : 'No bundle deals yet.'}</div>`}
    ${mgmt && products(bandId).length > 1 ? `<a class="btn-outline" href="#/merch/bundle/new">${icons.plus()} Add bundle</a>` : ''}
    <h2 class="section-h">Excel / CSV</h2>
    <div class="btn-row">
      <button type="button" class="btn-outline" data-action="export-stock">Export stock</button>
      ${mgmt ? `<label class="btn-outline file-btn">Import stock<input type="file" accept=".csv,text/csv,text/plain" data-import="stock" class="sr"></label>` : ''}
    </div>
    <p class="muted small">${mgmt ? 'Tip: export first, change the numbers or add rows in Excel, save as CSV, then import. Products not in the file stay untouched.' : 'Opens in Excel, Numbers or Google Sheets.'}</p>
  </main>`;
}

// ---------- SELL ----------
export function cartFor(bandId) {
  if (!state.cart || state.cart.band !== bandId) state.cart = { band: bandId, items: [] };
  return state.cart;
}
export function currentNight(bandId) {
  const { tonight } = sellOptions(bandId);
  if (state.sellNight && state.sellNight.band === bandId) return state.sellNight.key;
  return tonight ? tonight.id : 'd-' + sellOptions(bandId).today;
}

export function renderSell() {
  const bandId = merchBand();
  if (!bandId) return head('merch/sell', null, 'Merch') + '<main id="main"><div class="empty">Join or create a band first.</div></main>';
  const { shows, today } = sellOptions(bandId);
  const key = currentNight(bandId);
  const loc = state.sellLoc || 'van';            // van | storage | all | sold
  const where = loc === 'sold' ? 'all' : loc;     // which stock the numbers show
  const other = loc === 'van' ? 'storage' : 'van';
  const cart = cartFor(bandId);
  const tonight = summary(bandId, nightSales(bandId, key));
  const inCart = (pid, cid, z) => cart.items.filter((i) => i.pid === pid && (cid == null || i.cid === cid) && (z == null || i.size === z)).length;
  const allPs = products(bandId);
  const isGone = (p) => p.colours.reduce((t, c) => t + totalOf(p, c.id, 'all'), 0) === 0;
  const goneCount = allPs.filter(isGone).length;
  const ps = allPs.filter((p) => (loc === 'sold' ? isGone(p) : !isGone(p)));

  const opts = [...shows.map((e) => [e.id, `${fmtDay(e.date)} · ${e.place || e.title || 'Show'}`]), ['d-' + today, `${fmtDay(today)} · no show (other sale)`]];
  if (!opts.some(([k]) => k === key)) opts.unshift([key, nightTitle(bandId, key).place]);

  // One card per product (all colours together)
  const tiles = ps.map((p) => {
    const here = p.colours.reduce((t, c) => t + totalOf(p, c.id, where), 0) - inCart(p.id);
    const there = loc === 'van' || loc === 'storage' ? p.colours.reduce((t, c) => t + totalOf(p, c.id, other), 0) : 0;
    const withPhoto = p.colours[0];
    const sub = p.colours.length > 1 ? `${eur(p.price)} · ${p.colours.length} colours` : [eur(p.price), p.colours[0].name].filter(Boolean).join(' · ');
    const left = loc === 'sold' ? 'Sold out everywhere' : here > 0 ? `${here} left` : (there > 0 ? `0 here · ${there} in ${LOC_NAME[other].toLowerCase()}` : 'none left');
    return `<button type="button" class="sell-tile ${here > 0 ? '' : 'none-left'}" data-action="sell-tap" data-pid="${esc(p.id)}">
      ${pic(bandId, p, withPhoto, 'pic-sell')}
      ${p.colours.length > 1 ? `<span class="dots" aria-hidden="true">${p.colours.map((c) => `<i style="background:${esc(c.hex)}"></i>`).join('')}</span>` : ''}
      <span class="sell-name">${esc(p.name)}</span>
      <span class="muted small">${esc(sub)}</span>
      <span class="sell-left ${loc === 'sold' ? 'out' : here > 0 ? (here <= p.lowAt ? 'low' : '') : 'empty-here'}">${esc(left)}</span>
    </button>`;
  }).join('');

  const { discount, used } = bundleDiscount(bandId, cart.items);
  const sum = Math.round((cart.items.reduce((t, i) => t + i.price, 0) - discount) * 100) / 100;
  const pay = state.sellPay || 'card';
  const lines = cartLines(cart.items);
  const given = state.sellGiven;
  const givenOpts = [['exact', 'Exact'], [20, '€20'], [50, '€50'], [100, '€100']];
  const givenEur = given === 'exact' ? sum : Number(given) || null;
  const sold = state.sold && state.sold.band === bandId ? state.sold : null;

  const cartHtml = lines.length ? `<div class="cart">
      ${lines.map((l) => {
        const sizeTxt = l.size && l.size !== 'One size' ? l.size : '';
        const detail = [l.colour, sizeTxt].filter(Boolean).join(' · ');
        return `<div class="cart-line">
        <i class="cdot" style="background:${esc(colourHex(bandId, l.pid, l.cid))}" aria-hidden="true"></i>
        <span class="grow cart-name"><b>${esc(l.name)}</b>${detail ? `<span class="muted small">${esc(detail)}</span>` : ''}</span>
        <button type="button" class="qty-btn" data-action="cart-dec" data-pid="${esc(l.pid)}" data-cid="${esc(l.cid)}" data-size="${esc(l.size)}" aria-label="One less ${esc(l.name)}">−</button>
        <span class="qty">${l.qty}</span>
        <button type="button" class="qty-btn" data-action="cart-inc" data-pid="${esc(l.pid)}" data-cid="${esc(l.cid)}" data-size="${esc(l.size)}" aria-label="One more ${esc(l.name)}">+</button>
        <b class="line-sum">${eur(l.price * l.qty)}</b>
      </div>`;
      }).join('')}
      ${used.map((u) => `<div class="cart-line bundle"><span class="grow">Bundle: ${esc(u.name)}</span><b>−${eur(u.off)}</b></div>`).join('')}
      <div class="cart-total"><span class="muted">${cart.items.length} ${cart.items.length === 1 ? 'item' : 'items'}</span><b>${eur(sum)}</b></div>
      <div class="seg pay-seg" role="group" aria-label="Payment">${[['card', 'Card'], ['cash', 'Cash']].map(([k, l]) => `<button type="button" class="${pay === k ? 'on' : ''}" data-action="sell-pay" data-pay="${k}" aria-pressed="${pay === k}">${l}</button>`).join('')}</div>
      ${pay === 'cash' ? `<div class="given">
        <span class="muted small">Given</span>
        <div class="given-btns">${givenOpts.map(([v, l]) => `<button type="button" class="${String(given) === String(v) ? 'on' : ''}" data-action="sell-given" data-v="${v}" aria-pressed="${String(given) === String(v)}">${l}</button>`).join('')}</div>
        ${givenEur != null ? (givenEur >= sum ? `<div class="change"><span>Change</span><b>${eur(givenEur - sum)}</b></div>` : `<div class="change short"><span>Not enough</span><b>${eur(sum - givenEur)} missing</b></div>`) : ''}
      </div>` : ''}
      <button type="button" class="btn-primary charge-btn" data-action="charge">Charge ${eur(sum)} · ${pay === 'cash' ? 'cash' : 'card'}</button>
      <button type="button" class="link-btn clear-sale" data-action="cart-clear">Clear sale</button>
    </div>` : (sold ? '' : `<div class="empty">Tap a product to start a sale. Add as many items as you like, then charge once.</div>`);

  const soldHtml = sold ? `<div class="sold-banner" role="status"><span><b>Sold · ${eur(sold.total)}</b> · stock updated</span>
      <button type="button" class="btn-small" data-action="undo-last">Undo</button></div>` : '';

  const mine = tonight.list.slice().reverse().slice(0, 4);
  const last = mine.length ? `<h2 class="section-h">Last sales</h2>${mine.map((x) => `<div class="person sale-row">
      <span class="stack-2 grow"><span>${esc(cartLines(x.items).map((i) => (i.qty > 1 ? i.qty + '× ' : '') + i.name + (i.size && i.size !== 'One size' ? ' ' + i.size : '')).join(', '))}</span>
      <span class="muted small">${esc(String(x.at || '').slice(11, 16))} · ${x.pay === 'cash' ? 'Cash' : 'Card'} · ${eur(x.total)}${x.by !== me.id ? ' · ' + esc(x.byName || '') : ''}</span></span>
      ${x.by === me.id || isMgmt(bandId) ? `<button type="button" class="btn-small" data-action="undo-sale" data-id="${esc(x.id)}">Undo</button>` : ''}
    </div>`).join('')}` : '';

  return head('merch/sell', bandId, 'Merch') + `<main id="main" class="merch-main">
    <div class="sell-top card pad">
      <label class="lbl">Merch table for<select name="sellNight" data-band="${esc(bandId)}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === key ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <div class="row-inline wrap">
        <span class="sell-total"><b>${eur(tonight.total)}</b> <span class="muted small">tonight · ${tonight.count} ${tonight.count === 1 ? 'sale' : 'sales'} · ${tonight.items} items</span></span>
        <span class="grow"></span>
        <div class="seg sell-seg" role="group" aria-label="Selling from">${[...LOCS, ['all', 'All'], ['sold', `Sold out${goneCount ? ' ' + goneCount : ''}`]].map(([k, l]) => `<button type="button" class="${loc === k ? 'on' : ''} ${k === 'sold' ? 'sold-tab' : ''}" data-action="sell-loc" data-loc="${k}" aria-pressed="${loc === k}">${l}</button>`).join('')}</div>
      </div>
    </div>
    <div class="sell-layout">
      <div class="sell-grid">${tiles || `<div class="empty">${loc === 'sold' ? 'Nothing is completely sold out.' : allPs.length ? 'Everything is sold out. See the Sold out tab.' : `No products yet. ${isMgmt(bandId) ? 'Add them under Stock.' : 'MGMT can add them under Stock.'}`}</div>`}</div>
      <div class="sell-side">${soldHtml}${cartHtml}${last}
        <a class="btn-outline" href="#/merch/night/${esc(key)}">Night report & cash count</a>
      </div>
    </div>
  </main>${pickSheet(bandId, loc, inCart)}`;
}

// The sheet: pick colour + size
function pickSheet(bandId, loc, inCart) {
  if (!state.pick) return '';
  const p = productById(bandId, state.pick.pid);
  if (!p) return '';
  const c = p.colours.find((x) => x.id === state.pick.cid) || p.colours[0];
  const at = (cid, z) => (loc === 'all' ? count(p, cid, 'van', z) + count(p, cid, 'storage', z) : loc === 'sold' ? 0 : count(p, cid, loc, z));
  const left = (cid, z) => at(cid, z) - inCart(p.id, cid, z);
  const fromTxt = loc === 'all' ? 'van box first, then storage' : loc === 'sold' ? 'sold out everywhere' : 'from the ' + LOC_NAME[loc].toLowerCase();
  return `<div class="sheet-backdrop pick-backdrop" data-action="pick-close"></div>
  <div class="sheet pick-sheet" role="dialog" aria-modal="true" aria-label="${esc(p.name)}: pick ${p.colours.length > 1 ? 'colour and ' : ''}size">
    <div class="sheet-handle" aria-hidden="true"></div>
    <div class="row-inline">${pic(bandId, p, c, 'pic-mini')}<span class="stack-2 grow"><span class="sheet-title">${esc(p.name)}</span><span class="muted small">${eur(p.price)} · ${esc(fromTxt)}</span></span>
      <button type="button" class="icon-btn" data-action="pick-close" aria-label="Close">${icons.close(20)}</button></div>
    ${p.colours.length > 1 ? `<div class="colour-chips" role="group" aria-label="Colour">${p.colours.map((x) => {
      const n = p.sizes.reduce((t, z) => t + Math.max(0, left(x.id, z)), 0);
      return `<button type="button" class="colour-chip ${x.id === c.id ? 'on' : ''}" data-action="pick-colour" data-cid="${esc(x.id)}" aria-pressed="${x.id === c.id}"><i style="background:${esc(x.hex)}" aria-hidden="true"></i><span class="cname">${esc(x.name || 'Colour')}</span><span class="${n < 3 ? 'n low' : 'n'}">${n}</span></button>`;
    }).join('')}</div>` : ''}
    <div class="size-pick">${p.sizes.map((z) => {
      const n = left(c.id, z);
      return `<button type="button" class="size-btn ${n <= 0 ? 'out' : n <= p.lowAt ? 'low' : ''}" data-action="pick-size" data-size="${esc(z)}">
        <b>${esc(z)}</b><span>${n <= 0 ? '0 left' : n + ' left'}</span></button>`;
    }).join('')}</div>
    <p class="muted small">Tap a size to add it to the sale. None left but you still have one? Tap it anyway, the count goes below zero and you can fix it under Stock.</p>
  </div>`;
}

// ---------- NIGHTS ----------
export function renderNights() {
  const bandId = merchBand();
  if (!bandId) return head('merch/nights', null, 'Merch') + '<main id="main"><div class="empty">Join or create a band first.</div></main>';
  const list = nights(bandId);
  const rows = list.map((n) => `<a class="person" href="#/merch/night/${esc(n.key)}">
      <span class="row-date"><span class="wd">${n.date ? esc(fmtDay(n.date).split(' ')[0].toUpperCase()) : ''}</span><span class="dn">${n.date ? esc(String(+n.date.slice(8))) : '?'}</span></span>
      <span class="stack-2 grow"><span class="person-name">${esc(n.place)}</span><span class="muted small">${n.count} sales · ${n.items} items${n.doc.closed ? ' · closed' : ' · open'}</span></span>
      <b>${eur(n.total)}</b>
    </a>`).join('');
  return head('merch/nights', bandId, 'Merch') + `<main id="main" class="merch-main">
    ${rows || '<div class="empty">After the first sale, each show night shows up here with its report and cash count.</div>'}
    ${rows ? '<button type="button" class="btn-outline" data-action="export-sales">Export all sales (CSV for Excel)</button>' : ''}
  </main>`;
}

export function renderNight(key) {
  const bandId = merchBand();
  const t = nightTitle(bandId, key);
  const s = summary(bandId, nightSales(bandId, key));
  const doc = nightDoc(bandId, key);
  const mgmt = isMgmt(bandId);
  const float = doc.float != null ? doc.float : '';
  const should = (Number(doc.float) || 0) + s.cash;
  const sizes = Object.entries(s.sizes).sort((a, b) => b[1] - a[1]);
  const hints = refillHints(bandId);
  const headHtml = `<header class="head merch-head">
      <div class="topbar"><a class="link-btn" href="#/merch/nights">${icons.chevronLeft(18)} Nights</a><span class="muted small">${esc(bandById(bandId).name)}</span></div>
      <div class="title-row"><h1>Night report</h1></div>
      <p class="muted">${esc(t.date ? fmtDayLong(t.date) : '')} · ${esc(t.place)}</p>
    </header>`;
  return headHtml + `<main id="main" class="merch-main">
    <div class="grid-3 kpis">
      <div class="tile"><span class="label">Sold</span><b class="kpi">${eur(s.total)}</b></div>
      <div class="tile"><span class="label">Items · sales</span><b class="kpi">${s.items} · ${s.count}</b></div>
      <div class="tile"><span class="label">${mgmt ? 'Profit' : 'Card'}</span><b class="kpi">${mgmt ? (s.profit != null ? eur(s.profit) : '–') : eur(s.card)}</b></div>
    </div>
    ${mgmt && s.profit == null && s.count ? '<p class="muted small">Profit shows once every product has "what it cost us" filled in.</p>' : ''}

    <form data-form="night" data-key="${esc(key)}" class="card pad form">
      <span class="h2">Count the cash box</span>
      <label class="lbl">Float at the start (change in the box)<input type="text" inputmode="decimal" name="float" value="${esc(float)}" placeholder="e.g. 150"></label>
      <div class="cash-line"><span>Cash sales</span><b>${eur(s.cash)}</b></div>
      <div class="cash-line"><span>Should be in the box</span><b class="should" data-cash="${s.cash}">${eur(should)}</b></div>
      <label class="lbl">Counted<input type="text" inputmode="decimal" name="counted" value="${esc(doc.counted != null ? doc.counted : '')}" placeholder="What's really in the box"></label>
      <p class="diff small" aria-live="polite">${diffText(doc.counted, should)}</p>
      <p class="muted small">Card: ${eur(s.card)} · check it against the card reader's daily report.</p>
      <div class="btn-row">
        <button class="btn-outline" type="submit">Save count</button>
        ${doc.closed ? '<button class="btn-outline" type="button" data-action="night-close" data-do="reopen">Reopen night</button>' : '<button class="btn-primary" type="button" data-action="night-close" data-do="close">Close night</button>'}
      </div>
      ${doc.closed ? `<p class="form-info">Closed${doc.closedByName ? ' by ' + esc(doc.closedByName) : ''}. Money &amp; payouts come in the next update.</p>` : ''}
    </form>

    ${s.best.length ? `<h2 class="section-h">Best sellers</h2>${s.best.slice(0, 6).map((b) => `<div class="cash-line"><span>${esc(b.name)}</span><span>${b.n} · ${eur(b.eur)}</span></div>`).join('')}` : ''}
    ${sizes.length ? `<h2 class="section-h">Sizes sold</h2><div class="size-chips">${sizes.map(([z, n]) => `<span class="size-chip"><b>${esc(z)}</b> ${n}</span>`).join('')}</div>
      ${sizes.length > 1 && sizes[0][1] > sizes[1][1] ? `<p class="muted small">${esc(sizes[0][0])} sells best. Worth ordering more ${esc(sizes[0][0])} next time.</p>` : ''}` : ''}

    ${hints.moves.length || hints.soldOut.length || hints.low.length ? `<h2 class="section-h">Before the next show</h2>
      <div class="card pad stack-8">
        ${hints.moves.map((m) => `<div class="hint">${icons.chevronRight(16)}<span>Move ${m.n} × ${esc(m.name)} from storage to the van box</span></div>`).join('')}
        ${hints.soldOut.map((n) => `<div class="hint out">${icons.warn(16)}<span>${esc(n)}: sold out everywhere</span></div>`).join('')}
        ${hints.low.map((n) => `<div class="hint low">${icons.info(16)}<span>${esc(n)} (none in storage)</span></div>`).join('')}
        ${hints.moves.length ? '<button type="button" class="btn-outline" data-action="do-moves">Done, moved them (update the stock)</button>' : ''}
      </div>` : ''}

    ${s.count ? `<h2 class="section-h">All sales</h2>${s.list.slice().reverse().map((x) => `<div class="person sale-row">
      <span class="stack-2 grow"><span>${esc(x.items.map((i) => i.name + (i.colour ? ' ' + i.colour : '') + (i.size && i.size !== 'One size' ? ' ' + i.size : '')).join(', '))}</span>
      <span class="muted small">${esc(String(x.at || '').slice(11, 16))} · ${x.pay === 'cash' ? 'Cash' : 'Card'} · ${eur(x.total)}${x.byName ? ' · ' + esc(x.byName) : ''}</span></span>
      ${mgmt ? `<button type="button" class="btn-small" data-action="sale-pay" data-id="${esc(x.id)}" aria-label="Change to ${x.pay === 'cash' ? 'card' : 'cash'}">→ ${x.pay === 'cash' ? 'Card' : 'Cash'}</button>` : ''}
      ${x.by === me.id || mgmt ? `<button type="button" class="btn-small" data-action="undo-sale" data-id="${esc(x.id)}">Undo</button>` : ''}
    </div>`).join('')}` : '<div class="empty">No sales for this night yet.</div>'}
    ${s.count ? `<div class="btn-row"><button type="button" class="btn-outline" data-action="share-night">Share report</button><button type="button" class="btn-outline" data-action="export-night" data-key="${esc(key)}">Export (CSV)</button></div>` : ''}
    ${mgmt ? `<button type="button" class="btn-outline danger" data-action="delete-night" data-key="${esc(key)}">${icons.close(16)} Delete this night${s.count ? ` (${s.count} ${s.count === 1 ? 'sale' : 'sales'})` : ''}</button>
      <p class="muted small">For test sales or mistakes: removes the sales and the cash count, and puts the items back into stock.</p>` : ''}
  </main>`;
}

export function diffText(counted, should) {
  if (counted === '' || counted == null || Number.isNaN(Number(counted))) return '';
  const d = Math.round((Number(counted) - should) * 100) / 100;
  if (Math.abs(d) < 0.01) return '<span class="ok">Matches exactly.</span>';
  return d > 0 ? `<span class="low">${eur(d)} more than expected.</span>` : `<span class="out">${eur(-d)} missing.</span>`;
}

export function nightText(bandId, key) {
  const t = nightTitle(bandId, key);
  const s = summary(bandId, nightSales(bandId, key));
  const doc = nightDoc(bandId, key);
  const lines2 = [
    `${bandById(bandId).name} merch · ${t.date ? fmtDay(t.date) : ''} · ${t.place}`,
    `Sold: ${eur(s.total)} (${s.items} items, ${s.count} sales)`,
    `Cash: ${eur(s.cash)} · Card: ${eur(s.card)}`
  ];
  if (doc.counted != null) lines2.push(`Cash box counted: ${eur(doc.counted)} (float ${eur(doc.float || 0)})`);
  if (s.best.length) lines2.push('Best sellers: ' + s.best.slice(0, 3).map((b) => `${b.name} ${b.n}`).join(', '));
  return lines2.join('\n');
}

// ---------- PRODUCT FORM (MGMT) ----------
let seq = 0;
const cid = () => 'c' + Date.now().toString(36) + (seq++).toString(36);

export function ensureProductDraft(bandId, id) {
  const key = `${bandId}/${id || 'new'}`;
  if (state.pd && state.pd.key === key) return state.pd;
  const p = id && id !== 'new' ? productById(bandId, id) : null;
  if (p) {
    state.pd = {
      key, band: bandId, id: p.id, name: p.name || '', kind: p.kind || 'shirt', price: p.price, cost: p.cost != null ? p.cost : '', lowAt: p.lowAt,
      sizesText: p.sizes.join(', '),
      colours: p.colours.map((c) => ({ ...c })),
      photo: photo(bandId, p.id), photoChanged: false,
      stock: JSON.parse(JSON.stringify(p.stock || {})), orig: JSON.parse(JSON.stringify(p.stock || {})), order: p.order || 0,
      sel: p.colours[0].id, logType: 'edit', logNote: ''
    };
  } else {
    const first = cid();
    state.pd = { key, band: bandId, id: null, name: '', kind: 'shirt', price: '', cost: '', lowAt: 2, sizesText: SIZE_PRESETS.shirt, colours: [{ id: first, name: 'Black', hex: '#17181B' }], photo: null, photoChanged: false, stock: {}, orig: {}, order: Date.now(), sel: first, logType: 'edit', logNote: '' };
  }
  return state.pd;
}
export const newColourId = cid;

export function renderProductForm(id) {
  const bandId = merchBand();
  const isNew = !id || id === 'new';
  const headHtml = (title) => `<header class="head">
      <div class="topbar"><a class="link-btn" href="#/money" data-action="pd-cancel">Cancel</a><span class="muted small">${esc(bandById(bandId).name)} · merch</span></div>
      <div class="title-row"><h1>${esc(title)}</h1></div>
    </header>`;
  if (!bandId || !isMgmt(bandId)) return headHtml('Product') + '<main id="main"><div class="empty">Only MGMT can add or change products.</div></main>';
  if (!isNew && !productById(bandId, id)) return headHtml('Product') + '<main id="main"><div class="empty">This product doesn\'t exist anymore.</div></main>';
  const d = ensureProductDraft(bandId, id);
  const sizes = parseSizes(d.sizesText);
  d.renderedSizes = sizes;
  if (!d.colours.some((c) => c.id === d.sel)) d.sel = d.colours[0].id;
  const c = d.colours.find((x) => x.id === d.sel);
  const n = pdNumbers(d, sizes);
  const st = d.stock[c.id] || {};
  const sumCls = (t) => (t <= 0 ? 'out' : t < 3 ? 'low' : '');
  const log = d.id ? productLog(bandId, d.id, 5) : [];
  const p0 = d.id ? productById(bandId, d.id) : null;

  const card = `<fieldset class="card pad stack-8 colour-block">
      <legend class="sr">${esc(c.name || 'Colour')}</legend>
      <div class="grid-2">
        <label class="lbl">Colour name<input type="text" name="c_name_${esc(c.id)}" maxlength="24" value="${esc(c.name || '')}" placeholder="e.g. Black"></label>
        <label class="lbl">Colour<select name="c_hex_${esc(c.id)}">${COLOURS.map(([nm, h]) => `<option value="${h}" ${h === c.hex ? 'selected' : ''}>${nm}</option>`).join('')}${COLOURS.some(([, h]) => h === c.hex) ? '' : `<option value="${esc(c.hex)}" selected>Custom</option>`}</select></label>
      </div>
      <div class="move-row"><span class="muted small"><b data-sel-storage>${n.byColour[c.id].storage}</b> in storage</span>
        <button type="button" class="btn-small move-all" data-action="pd-move-all">Move all storage → van box</button></div>
      <div class="stock-grid sum-grid">
        <span class="label">Size</span><span class="label loc-van">Van box</span><span class="label loc-storage">Storage</span><span class="label right">Σ</span>
        ${sizes.map((z, zi) => {
          const t = (Number((st.van || {})[z]) || 0) + (Number((st.storage || {})[z]) || 0);
          return `<span class="size-cell"><b>${esc(z)}</b></span>${LOCS.map(([l]) => `<span class="stepper">
          <button type="button" class="step" data-action="step" data-target="st_${esc(c.id)}_${l}_${zi}" data-d="-1" aria-label="${esc(z)} ${LOC_NAME[l]} minus one">−</button>
          <input type="number" inputmode="numeric" name="st_${esc(c.id)}_${l}_${zi}" value="${Number((st[l] || {})[z]) || 0}" aria-label="${esc(z)} ${LOC_NAME[l]}">
          <button type="button" class="step" data-action="step" data-target="st_${esc(c.id)}_${l}_${zi}" data-d="1" aria-label="${esc(z)} ${LOC_NAME[l]} plus one">+</button></span>`).join('')}
          <b class="sum-cell ${sumCls(t)}" data-sum="${zi}">${t}</b>`;
        }).join('')}
      </div>
      <div class="row-inline wrap"><span class="muted small grow"><b data-sel-total>${n.byColour[c.id].total}</b> in total</span>
        <span class="muted small legend-dots"><i class="ld low"></i>under 3 · <i class="ld out"></i>sold out</span></div>
      <div class="grid-2">
        <label class="lbl">What happened?<select name="logType">${[['edit', 'Manual edit'], ['delivery', 'Delivery'], ['count', 'Stock count'], ['gone', 'Damaged / given away']].map(([k, l]) => `<option value="${k}" ${d.logType === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="lbl">Note (optional)<input type="text" name="logNote" maxlength="60" value="${esc(d.logNote || '')}" placeholder="e.g. Spreadshirt SP-28974113"></label>
      </div>
      ${d.colours.length > 1 ? `<button type="button" class="btn-small danger" data-action="pd-colour-remove" data-cid="${esc(c.id)}">Remove colour ${esc(c.name || '')}</button>` : ''}
    </fieldset>`;

  const recent = log.length ? `<span class="lbl-text">Recent changes</span>
    <div class="card log-list">${log.map((l) => {
      const what = LOG_TYPES[l.type] || 'Change';
      const sized = p0 && p0.sizes.length > 1;
      const parts = [
        l.note,
        p0 && p0.colours.length > 1 && l.colour ? l.colour : '',
        l.type === 'move' ? (l.size ? (sized ? l.size : '') : 'all sizes') : (sized ? l.size : ''),
        logDate(l.at),
        l.type === 'move' ? 'storage → van box' : (LOC_NAME[l.loc] || '').toLowerCase(),
        l.byName
      ].filter(Boolean);
      const num = Number(l.n) || 0;
      const nTxt = l.type === 'move' ? String(Math.abs(num)) : (num > 0 ? '+' + num : '−' + Math.abs(num));
      return `<div class="log-row"><span class="stack-2 grow"><b>${esc(what)}</b><span class="muted small">${esc(parts.join(' · '))}</span></span>
        <b class="${l.type === 'move' ? 'muted' : num > 0 ? 'plus' : 'minus'}">${esc(nTxt)}</b></div>`;
    }).join('')}</div>` : '';

  return headHtml(isNew ? 'New product' : (d.name || 'Product')) + `<main id="main">
    ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
    <form data-form="product" class="form">
      <label class="lbl">Name<input type="text" name="name" required maxlength="40" value="${esc(d.name)}" placeholder="e.g. Fragments shirt"></label>
      <div class="grid-2">
        <label class="lbl">Kind<select name="kind">${KINDS.map(([k, l]) => `<option value="${k}" ${k === d.kind ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="lbl">Sizes<input type="text" name="sizesText" maxlength="80" value="${esc(d.sizesText)}" placeholder="S, M, L, XL"></label>
      </div>
      <div class="grid-2">
        <label class="lbl">Price<input type="text" inputmode="decimal" name="price" value="${esc(d.price)}" placeholder="€ 25"></label>
        <label class="lbl">What it cost us (MGMT only)<input type="text" inputmode="decimal" name="cost" value="${esc(d.cost)}" placeholder="€ 9.50"></label>
      </div>
      <p class="muted small profit-line">${profitText(d.price, d.cost)}</p>

      <div class="row-inline product-photo">
        ${d.photo ? `<img class="pic pic-edit" src="${d.photo}" alt="Photo of ${esc(d.name || 'the product')}">` : `<span class="pic pic-edit" style="background:#2C2F35">${art(d.kind, c.hex)}</span>`}
        <div class="stack-8 grow">
          <span class="lbl-text">Photo · one for all colours</span>
          <label class="photo-btn btn-small">${icons.plus(14)} Take photo<input type="file" accept="image/*" capture="environment" data-photo="product" class="sr"></label>
          <label class="photo-btn btn-small">From gallery<input type="file" accept="image/*" data-photo="product" class="sr"></label>
          ${d.photo ? `<span class="muted small">${kb(d.photo)} KB · works offline · <button type="button" class="link-btn small" data-action="pd-photo-remove">remove</button></span>` : '<span class="muted small">Shrunk automatically to about 100 KB.</span>'}
        </div>
      </div>

      <div class="stat-tiles">
        <div class="stat"><span class="label"><i style="background:var(--text)"></i>Total</span><b data-tile="total">${n.total}</b></div>
        <div class="stat"><span class="label"><i class="loc-van-bg"></i>Van box</span><b data-tile="van">${n.van}</b></div>
        <div class="stat"><span class="label"><i class="loc-storage-bg"></i>Storage</span><b data-tile="storage">${n.storage}</b></div>
        <div class="stat"><span class="label"><i style="background:var(--amber)"></i>Low sizes</span><b data-tile="low" class="${n.low ? 'low' : ''}">${n.low}</b></div>
      </div>

      <span class="lbl-text">Colours · tap one to edit its stock</span>
      <div class="colour-chips" role="group" aria-label="Colours">
        ${d.colours.map((x) => `<button type="button" class="colour-chip ${x.id === c.id ? 'on' : ''}" data-action="pd-colour-pick" data-cid="${esc(x.id)}" aria-pressed="${x.id === c.id}"><i style="background:${esc(x.hex)}" aria-hidden="true"></i><span class="cname">${esc(x.name || 'Colour')}</span><span class="n ${n.byColour[x.id].total < 3 ? 'low' : ''}" data-chip-n="${esc(x.id)}">${n.byColour[x.id].total}</span></button>`).join('')}
        <button type="button" class="colour-chip add" data-action="pd-colour-add">+ Colour</button>
      </div>
      ${card}
      ${recent}
      <label class="lbl">Warn me when a size drops to<input type="number" inputmode="numeric" name="lowAt" min="0" max="50" value="${esc(d.lowAt)}"></label>
      <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${isNew ? 'Add product' : 'Save'}</button>
      ${isNew ? '' : `<button type="button" class="btn-outline danger" data-action="pd-delete">${icons.close(16)} Delete product</button>`}
    </form>
  </main>`;
}

// Totals for the edit screen (from the draft, before saving)
export function pdNumbers(d, sizes) {
  const out = { total: 0, van: 0, storage: 0, low: 0, byColour: {} };
  d.colours.forEach((c) => {
    const st = d.stock[c.id] || {};
    const b = (out.byColour[c.id] = { total: 0, van: 0, storage: 0, sizes: [] });
    sizes.forEach((z) => {
      const v = Math.max(0, Number((st.van || {})[z]) || 0);
      const s2 = Math.max(0, Number((st.storage || {})[z]) || 0);
      b.van += v; b.storage += s2; b.total += v + s2; b.sizes.push(v + s2);
      if (v + s2 > 0 && v + s2 < 3) out.low += 1;
    });
    out.van += b.van; out.storage += b.storage; out.total += b.total;
  });
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const logDate = (at) => (at && at.length >= 10 ? `${+at.slice(8, 10)} ${MONTHS[+at.slice(5, 7) - 1] || ''}` : '');

export function profitText(price, cost) {
  const p = parseFloat(String(price).replace(',', '.'));
  const c = parseFloat(String(cost).replace(',', '.'));
  if (!(p > 0) || !(c >= 0) || String(cost).trim() === '') return 'Fill in both to see the profit per piece.';
  return `Profit per piece: ${eur(p - c)}`;
}

// ---------- BUNDLE FORM (MGMT) ----------
export function renderBundleForm(id) {
  const bandId = merchBand();
  const isNew = !id || id === 'new';
  const b = isNew ? { name: '', items: [], price: '' } : bundles(bandId).find((x) => x.id === id);
  const headHtml = `<header class="head">
      <div class="topbar"><a class="link-btn" href="#/money">Cancel</a><span class="muted small">${esc(bandById(bandId).name)} · merch</span></div>
      <div class="title-row"><h1>${isNew ? 'New bundle' : 'Bundle'}</h1></div>
    </header>`;
  if (!bandId || !isMgmt(bandId) || !b) return headHtml + `<main id="main"><div class="empty">${!b ? 'This bundle doesn\'t exist anymore.' : 'Only MGMT can change bundles.'}</div></main>`;
  const ps = products(bandId);
  return headHtml + `<main id="main">
    ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
    <form data-form="bundle" data-id="${esc(isNew ? '' : id)}" class="form">
      <label class="lbl">Name<input type="text" name="name" maxlength="40" value="${esc(b.name || '')}" placeholder="e.g. Shirt + Vinyl"></label>
      <fieldset class="choice"><legend class="lbl-text">What's in it (tick 2 or more)</legend>
        <div class="check-list">${ps.map((p) => `<label class="check"><input type="checkbox" name="items" value="${esc(p.id)}" ${b.items.includes(p.id) ? 'checked' : ''}><span class="grow">${esc(p.name)}</span><span class="muted">${eur(p.price)}</span></label>`).join('')}</div>
      </fieldset>
      <label class="lbl">Bundle price<input type="text" inputmode="decimal" name="price" required value="${esc(b.price)}" placeholder="€ 50"></label>
      <p class="muted small">Applied automatically when everything is in the cart (any colour or size).</p>
      <button class="btn-primary" type="submit">${isNew ? 'Add bundle' : 'Save'}</button>
      ${isNew ? '' : `<button type="button" class="btn-outline danger" data-action="bundle-delete" data-id="${esc(id)}">${icons.close(16)} Delete bundle</button>`}
    </form>
  </main>`;
}

export { nightKeyOf, salesOf };
