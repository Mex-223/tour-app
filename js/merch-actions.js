// Merch: what happens when you tap, type or save on the merch screens.
import { state, me, bandById, merchOf } from './store.js';
import {
  merchBand, products, productById, parseEur, parseSizes, bundleDiscount, refillHints, salesOf, SIZE_PRESETS, COLOURS
} from './merch.js';
import { cartFor, currentNight, newColourId, diffText, nightText, profitText, pdNumbers } from './views/merch.js';
import { nightSales, summary, nightDoc } from './merch.js';
import { shrinkPhoto } from './photo.js';
import { eur, count, KINDS, KIND_NAME, nightTitle, nightKeyOf, LOC_NAME, cartLines, nowLocal, saleLogs, saleLogIds } from './merch.js';
import { saveCsv, parseCsv, fileDate, slug } from './csv.js';
import { isMgmt } from './store.js';

export function installMerch({ getBackend, render, toast, run, actions, forms }) {
  const backend = () => getBackend();

  // ---------- Product draft: read the form into state.pd ----------
  function collectPd(form) {
    const d = state.pd;
    if (!d || !form) return d;
    const f = new FormData(form);
    const get = (k, dflt = '') => (f.has(k) ? String(f.get(k)) : dflt);
    d.name = get('name', d.name);
    d.kind = get('kind', d.kind);
    d.sizesText = get('sizesText', d.sizesText);
    d.price = get('price', d.price);
    d.cost = get('cost', d.cost);
    d.lowAt = get('lowAt', d.lowAt);
    d.logType = get('logType', d.logType || 'edit');
    d.logNote = get('logNote', d.logNote || '');
    const sizes = d.renderedSizes || parseSizes(d.sizesText);
    d.colours.forEach((c) => {
      c.name = get(`c_name_${c.id}`, c.name);
      c.hex = get(`c_hex_${c.id}`, c.hex);
      const st = (d.stock[c.id] = d.stock[c.id] || {});
      ['van', 'storage'].forEach((l) => {
        const at = (st[l] = st[l] || {});
        sizes.forEach((z, zi) => {
          const k = `st_${c.id}_${l}_${zi}`;
          if (f.has(k)) at[z] = Math.max(0, Math.round(Number(f.get(k)) || 0));
        });
      });
    });
    return d;
  }
  const pdForm = () => document.querySelector('form[data-form="product"]');

  // Update the numbers on the edit screen (tiles, colour chips, Σ) without redrawing it
  function refreshPd() {
    const form = pdForm();
    const d = collectPd(form);
    if (!d || !form) return;
    const sizes = d.renderedSizes || parseSizes(d.sizesText);
    const n = pdNumbers(d, sizes);
    const set = (sel, v, cls) => { const el = form.querySelector(sel); if (el) { el.textContent = v; if (cls !== undefined) el.className = cls; } };
    set('[data-tile=total]', n.total); set('[data-tile=van]', n.van); set('[data-tile=storage]', n.storage); set('[data-tile=low]', n.low, n.low ? 'low' : '');
    d.colours.forEach((c) => set(`[data-chip-n="${c.id}"]`, n.byColour[c.id].total, n.byColour[c.id].total < 3 ? 'n low' : 'n'));
    const b = n.byColour[d.sel];
    if (b) {
      set('[data-sel-total]', b.total); set('[data-sel-storage]', b.storage);
      b.sizes.forEach((t, zi) => set(`[data-sum="${zi}"]`, t, 'sum-cell ' + (t <= 0 ? 'out' : t < 3 ? 'low' : '')));
    }
  }

  // ---------- Taps ----------
  Object.assign(actions, {
    'merch-band': (el) => { state.merchBand = el.dataset.band; state.cart = null; state.pick = null; state.sold = null; },
    'stock-loc': (el) => { state.stockLoc = el.dataset.loc; },
    'stock-open': (el) => {
      const o = state.stockOpen || {};
      state.stockOpen = o.pid === el.dataset.pid ? {} : { pid: el.dataset.pid, cid: null };
    },
    'stock-colour': (el) => {
      const o = state.stockOpen || {};
      state.stockOpen = { pid: el.dataset.pid, cid: o.cid === el.dataset.cid ? null : el.dataset.cid };
    },
    'sold-toggle': () => { state.soldOpen = !state.soldOpen; },
    'sell-loc': (el) => { state.sellLoc = el.dataset.loc; },
    'sell-pay': (el) => { state.sellPay = el.dataset.pay; state.sellGiven = null; },
    'sell-given': (el) => { state.sellGiven = el.dataset.v === 'exact' ? 'exact' : Number(el.dataset.v); },
    'sell-tap': (el) => {
      const bandId = merchBand();
      const p = productById(bandId, el.dataset.pid);
      if (!p) return 'none';
      // One colour and one size (e.g. vinyl): straight into the cart
      if (p.colours.length === 1 && p.sizes.length === 1) { addToCart(bandId, p, p.colours[0].id, p.sizes[0]); return undefined; }
      const loc = state.sellLoc || 'van';
      const has = (c, z) => (loc === 'all' ? count(p, c.id, 'van', z) + count(p, c.id, 'storage', z) : count(p, c.id, loc === 'storage' ? 'storage' : 'van', z)) > 0;
      const withStock = p.colours.find((c) => p.sizes.some((z) => has(c, z)));
      state.pick = { pid: p.id, cid: (withStock || p.colours[0]).id };
      return undefined;
    },
    'pick-colour': (el) => { if (state.pick) state.pick.cid = el.dataset.cid; },
    'pick-size': (el) => {
      const bandId = merchBand();
      const p = state.pick && productById(bandId, state.pick.pid);
      if (p) addToCart(bandId, p, state.pick.cid, el.dataset.size);
      state.pick = null;
    },
    'pick-close': () => { state.pick = null; },
    'cart-inc': (el) => {
      const bandId = merchBand();
      const p = productById(bandId, el.dataset.pid);
      if (p) addToCart(bandId, p, el.dataset.cid, el.dataset.size);
    },
    'cart-dec': (el) => {
      const c = cartFor(merchBand());
      for (let i = c.items.length - 1; i >= 0; i -= 1) {
        const it = c.items[i];
        if (it.pid === el.dataset.pid && it.cid === el.dataset.cid && it.size === el.dataset.size) { c.items.splice(i, 1); break; }
      }
      if (!c.items.length) state.sellGiven = null;
    },
    'cart-clear': () => { cartFor(merchBand()).items = []; state.sellGiven = null; },
    'cart-remove': (el) => { const c = cartFor(merchBand()); c.items.splice(Number(el.dataset.i), 1); },
    charge: () => {
      const bandId = merchBand();
      const cart = cartFor(bandId);
      if (!cart.items.length) return 'none';
      const { discount } = bundleDiscount(bandId, cart.items);
      const total = Math.round((cart.items.reduce((t, i) => t + i.price, 0) - discount) * 100) / 100;
      const key = currentNight(bandId);
      const mode = state.sellLoc || 'van';
      const pay = state.sellPay || 'card';
      const local = nowLocal();
      // Where each item comes from. "All": van box first, then storage. "Sold out" tab: van box (goes below zero).
      const used = {};
      const items = cart.items.map((i) => {
        let from = mode === 'storage' ? 'storage' : 'van';
        if (mode === 'all') {
          const p = productById(bandId, i.pid);
          const k = (l) => `${i.pid}|${i.cid}|${i.size}|${l}`;
          const left = (l) => (p ? count(p, i.cid, l, i.size) : 0) - (used[k(l)] || 0);
          from = left('van') > 0 ? 'van' : (left('storage') > 0 ? 'storage' : 'van');
          used[k(from)] = (used[k(from)] || 0) + 1;
        }
        return { ...i, loc: from };
      });
      const loc = mode === 'all' ? 'all' : (mode === 'storage' ? 'storage' : 'van');
      const ev = key.startsWith('d-') ? null : key;
      const sale = {
        at: local, date: key.startsWith('d-') ? key.slice(2) : local.slice(0, 10), eventId: ev, night: key,
        by: me.id, byName: me.name, pay, loc, items, discount, total
      };
      const moves = items.map((i) => ({ pid: i.pid, cid: i.cid, loc: i.loc, size: i.size, n: -1 }));
      const id = backend().newId();
      state.sold = { band: bandId, saleId: id, total, items: cart.items.map((i) => ({ ...i })) };
      state.cart = { band: bandId, items: [] };
      state.sellGiven = null;
      backend().recordSale(bandId, id, sale, moves, { logs: saleLogs(id, sale) }).catch((err) => toast(err.message || 'Could not save the sale.'));
      return undefined;
    },
    // The green "Sold" bar: Undo takes the sale back and puts the items back into the cart
    'undo-last': () => {
      const bandId = merchBand();
      const sold = state.sold;
      if (!sold || sold.band !== bandId) return 'none';
      const s = salesOf(bandId).find((x) => x.id === sold.saleId);
      state.sold = null;
      state.cart = { band: bandId, items: sold.items.map((i) => ({ ...i })) };
      if (s) backend().undoSale(bandId, s.id, backMoves(bandId, [s]), { dropLogs: saleLogIds(s.id, s.items, s.loc) }).catch((err) => toast(err.message || 'Could not undo.'));
      toast('Sale undone. The items are back in the cart.');
      return undefined;
    },
    'undo-sale': (el) => {
      const bandId = merchBand();
      const s = salesOf(bandId).find((x) => x.id === el.dataset.id);
      if (!s || !confirm(`Undo this sale (${eur(s.total)})? The items go back into stock.`)) return 'none';
      if (state.sold && state.sold.saleId === s.id) state.sold = null;
      run(async () => { await backend().undoSale(bandId, s.id, backMoves(bandId, [s]), { dropLogs: saleLogIds(s.id, s.items, s.loc) }); toast('Sale undone. The items are back in stock.'); });
      return 'none';
    },
    'sale-pay': (el) => {
      const bandId = merchBand();
      const s = salesOf(bandId).find((x) => x.id === el.dataset.id);
      if (!s) return 'none';
      const { id, ...rest } = s;
      const pay = s.pay === 'cash' ? 'card' : 'cash';
      run(async () => { await backend().saveMerch(bandId, 'sales', id, { ...rest, pay }); toast(`Changed to ${pay}.`); });
      return 'none';
    },
    'delete-night': (el) => {
      const bandId = merchBand();
      const key = el.dataset.key;
      const list = nightSales(bandId, key);
      const total = list.reduce((t, x) => t + x.total, 0);
      const msg = list.length
        ? `Delete this night? All ${list.length} ${list.length === 1 ? 'sale' : 'sales'} (${eur(total)}) and the cash count are removed, and the items go back into stock.`
        : 'Delete this night and its cash count?';
      if (!confirm(msg)) return 'none';
      run(async () => {
        await backend().deleteNight(bandId, key, list.map((x) => x.id), backMoves(bandId, list), { dropLogs: list.flatMap((x) => saleLogIds(x.id, x.items, x.loc)) });
        location.hash = '#/merch/nights';
        toast('Night deleted.');
      });
      return 'none';
    },
    'do-moves': () => {
      const bandId = merchBand();
      const { moves } = refillHints(bandId);
      if (!moves.length) return 'none';
      const list = moves.flatMap((m) => [{ pid: m.pid, cid: m.cid, loc: 'van', size: m.size, n: m.n }, { pid: m.pid, cid: m.cid, loc: 'storage', size: m.size, n: -m.n }]);
      const at = nowLocal();
      const logs = moves.map((m) => {
        const p = productById(bandId, m.pid);
        const c = p && p.colours.find((x) => x.id === m.cid);
        return { id: backend().newId(), pid: m.pid, type: 'move', cid: m.cid, colour: (c && c.name) || '', size: m.size, loc: 'van', n: m.n, note: '', at, ts: Date.now(), by: me.id, byName: me.name };
      });
      run(async () => { await backend().changeStock(bandId, list, null, { logs }); toast('Stock updated: moved to the van box.'); });
      return 'none';
    },
    'share-night': () => {
      const bandId = merchBand();
      const key = decodeURIComponent(location.hash.split('/')[3] || '');
      const text = nightText(bandId, key);
      if (navigator.share) navigator.share({ title: 'Merch night report', text }).catch(() => {});
      else navigator.clipboard.writeText(text).then(() => toast('Report copied. Paste it into WhatsApp.'), () => toast('Could not copy.'));
      return 'none';
    },
    'night-close': (el) => {
      const form = document.querySelector('form[data-form="night"]');
      if (!form) return 'none';
      saveNight(form, el.dataset.do);
      return 'none';
    },
    step: (el) => {
      const input = document.querySelector(`input[name="${el.dataset.target}"]`);
      if (!input) return 'none';
      input.value = Math.max(0, (Math.round(Number(input.value)) || 0) + Number(el.dataset.d));
      state.formDirty = true;
      refreshPd();
      return 'none';
    },
    'pd-colour-pick': (el) => {
      const d = collectPd(pdForm());
      if (d) d.sel = el.dataset.cid;
      state.formDirty = false;
    },
    'pd-move-all': () => {
      const d = collectPd(pdForm());
      if (!d) return 'none';
      const sizes = d.renderedSizes || parseSizes(d.sizesText);
      let moved = 0;
      sizes.forEach((z, zi) => {
        const v = document.querySelector(`input[name="st_${d.sel}_van_${zi}"]`);
        const st = document.querySelector(`input[name="st_${d.sel}_storage_${zi}"]`);
        if (!v || !st) return;
        const n = Math.max(0, Math.round(Number(st.value)) || 0);
        moved += n;
        v.value = (Math.round(Number(v.value)) || 0) + n;
        st.value = 0;
      });
      if (!moved) { toast('Nothing in storage for this colour.'); return 'none'; }
      state.formDirty = true;
      refreshPd();
      toast(`${moved} moved to the van box. Tap Save to keep it.`);
      return 'none';
    },
    'pd-cancel': () => { state.pd = null; return 'nav'; },
    'pd-colour-add': () => {
      const d = collectPd(pdForm());
      const used = d.colours.map((c) => c.hex);
      const [name, hex] = COLOURS.find(([, h]) => !used.includes(h)) || COLOURS[0];
      const nc = { id: newColourId(), name, hex };
      d.colours.push(nc);
      d.sel = nc.id;
      state.formDirty = false;
    },
    'pd-colour-remove': (el) => {
      const d = collectPd(pdForm());
      if (!confirm('Remove this colour with its stock?')) return 'none';
      d.removed = [...(d.removed || []), el.dataset.cid];
      d.colours = d.colours.filter((c) => c.id !== el.dataset.cid);
      delete d.stock[el.dataset.cid];
      state.formDirty = false;
      return undefined;
    },
    'pd-photo-remove': () => {
      const d = collectPd(pdForm());
      if (d) { d.photo = null; d.photoChanged = true; }
      state.formDirty = false;
    },
    'pd-delete': () => {
      const d = state.pd;
      if (!d || !d.id || !confirm(`Delete "${d.name || 'this product'}"? Past sales stay in the reports.`)) return 'none';
      run(async () => {
        await backend().deleteProduct(d.band, d.id, [d.id, ...d.colours.map((c) => `${d.id}_${c.id}`), ...(d.removed || []).map((x) => `${d.id}_${x}`)]);
        state.pd = null;
        location.hash = '#/money';
        toast('Product deleted.');
      });
      return 'none';
    },
    'bundle-delete': (el) => {
      if (!confirm('Delete this bundle?')) return 'none';
      run(async () => { await backend().deleteItem(merchBand(), 'bundles', el.dataset.id); location.hash = '#/money'; toast('Bundle deleted.'); });
      return 'none';
    }
  });

  // Put sold items back (only for products that still exist)
  function backMoves(bandId, sales) {
    const ids = new Set(products(bandId).map((p) => p.id));
    return sales.flatMap((x) => x.items.filter((i) => ids.has(i.pid)).map((i) => ({ pid: i.pid, cid: i.cid, loc: i.loc || (x.loc === 'all' ? 'van' : x.loc) || 'van', size: i.size, n: 1 })));
  }

  function addToCart(bandId, p, cid, size) {
    const c = p.colours.find((x) => x.id === cid) || p.colours[0];
    cartFor(bandId).items.push({ pid: p.id, cid: c.id, size, name: p.name, colour: p.colours.length > 1 ? (c.name || '') : '', price: p.price });
    state.sold = null;
  }

  function saveNight(form, mode) {
    const bandId = merchBand();
    const f = new FormData(form);
    const key = form.dataset.key;
    const num = (k) => (String(f.get(k) || '').trim() === '' ? null : parseEur(f.get(k)));
    const data = { float: num('float'), counted: num('counted') };
    if (mode === 'close') Object.assign(data, { closed: true, closedBy: me.id, closedByName: me.name, closedAt: new Date().toISOString() });
    if (mode === 'reopen') Object.assign(data, { closed: false });
    run(async () => {
      await backend().saveNight(bandId, key, data);
      toast(mode === 'close' ? 'Night closed.' : mode === 'reopen' ? 'Night reopened.' : 'Count saved.');
    });
  }

  // ---------- CSV export / import ----------
  const STOCK_HEAD = ['Product', 'Colour', 'Size', 'Van box', 'Storage', 'Total', 'Price', 'Kind'];
  function stockRows(bandId) {
    const mgmt = isMgmt(bandId);
    const rows = [[...STOCK_HEAD, ...(mgmt ? ['Cost'] : []), 'ID']];
    let van = 0; let st = 0;
    products(bandId).forEach((p) => p.colours.forEach((c) => p.sizes.forEach((z) => {
      const v = count(p, c.id, 'van', z);
      const s2 = count(p, c.id, 'storage', z);
      van += v; st += s2;
      rows.push([p.name, c.name || '', z, v, s2, v + s2, p.price, KIND_NAME[p.kind] || 'Other', ...(mgmt ? [p.cost != null ? p.cost : ''] : []), p.id]);
    })));
    rows.push(['TOTAL', '', '', van, st, van + st]);
    return rows;
  }

  // Sales list + TOTAL row + a short summary.
  function salesRows(bandId, list) {
    const mgmt = isMgmt(bandId);
    const prods = Object.fromEntries(products(bandId).map((p) => [p.id, p]));
    const de = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
    const r2 = (n) => Math.round(n * 100) / 100;
    const rows = [['Date', 'Time', 'Show', 'Product', 'Colour', 'Size', 'Price', 'Payment', 'Sold by']];
    const T = { total: 0, card: 0, cash: 0, items: 0, cost: 0, costKnown: true };
    list.forEach((x) => {
      const t = nightTitle(bandId, nightKeyOf(x));
      const date = de(String(x.at || x.date || '').slice(0, 10));
      const time = String(x.at || '').slice(11, 16);
      const pay = x.pay === 'cash' ? 'Cash' : 'Card';
      T.total += x.total; T[x.pay === 'cash' ? 'cash' : 'card'] += x.total;
      x.items.forEach((i) => {
        T.items += 1;
        const p = prods[i.pid];
        if (p && p.cost != null) T.cost += p.cost; else T.costKnown = false;
        rows.push([date, time, t.place, i.name, i.colour || '', i.size && i.size !== 'One size' ? i.size : '', Number(i.price) || 0, pay, x.byName || '']);
      });
      if (x.discount) rows.push([date, time, t.place, 'Bundle discount', '', '', -x.discount, pay, x.byName || '']);
    });
    rows.push(['TOTAL', '', '', `${T.items} items`, '', '', r2(T.total), '', '']);
    rows.push([], ['Card', r2(T.card)], ['Cash', r2(T.cash)]);
    if (mgmt && T.costKnown && list.length) rows.push(['Profit', r2(T.total - T.cost)]);
    return rows;
  }

  const bandSlug = (bandId) => slug(bandById(bandId).name);

  Object.assign(actions, {
    'export-stock': () => {
      const bandId = merchBand();
      saveCsv(`${bandSlug(bandId)}-merch-stock-${fileDate()}.csv`, stockRows(bandId));
      return 'none';
    },
    'export-sales': () => {
      const bandId = merchBand();
      saveCsv(`${bandSlug(bandId)}-merch-sales-${fileDate()}.csv`, salesRows(bandId, salesOf(bandId)));
      return 'none';
    },
    'export-night': (el) => {
      const bandId = merchBand();
      const key = el.dataset.key;
      const t = nightTitle(bandId, key);
      saveCsv(`${bandSlug(bandId)}-merch-${t.date || fileDate()}-${slug(t.place)}.csv`, salesRows(bandId, nightSales(bandId, key)));
      return 'none';
    }
  });

  // Read a stock file (the export, edited in Excel) and work out what would change.
  function planImport(bandId, text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('That file looks empty.');
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
    const head = rows[0].map(norm);
    const col = (...names) => head.findIndex((h) => names.map(norm).includes(h));
    const C = {
      name: col('Product', 'Produkt', 'Name', 'Artikel'), colour: col('Colour', 'Color', 'Farbe'), size: col('Size', 'Größe', 'Groesse'),
      van: col('Van box', 'Van', 'Merch box', 'Tour'), storage: col('Storage', 'Lager'), price: col('Price', 'Preis'),
      kind: col('Kind', 'Art', 'Type'), cost: col('Cost', 'Kosten', 'Einkauf'), id: col('ID')
    };
    if (C.name < 0) throw new Error('No "Product" column found. Start from an exported stock file so the columns match.');
    if (C.van < 0 && C.storage < 0 && C.price < 0) throw new Error('No "Van box", "Storage" or "Price" column found.');
    const get = (r, i) => (i >= 0 ? String(r[i] || '').trim() : '');
    const kindOf = (s) => { const k = KINDS.find(([key, l]) => norm(key) === norm(s) || norm(l) === norm(s)); return k ? k[0] : null; };
    const existing = products(bandId);
    const plans = {};
    let counts = 0;
    rows.slice(1).forEach((r) => {
      const name = get(r, C.name);
      if (!name || /^total$/i.test(name)) return;
      const id = get(r, C.id);
      const p = (id && existing.find((x) => x.id === id)) || existing.find((x) => norm(x.name) === norm(name));
      const key = p ? p.id : 'new:' + norm(name);
      const plan = plans[key] || (plans[key] = p
        ? { isNew: false, id: p.id, name: p.name, kind: p.kind, price: p.price, sizes: p.sizes.slice(), colours: p.colours.map((c) => ({ ...c })), stock: JSON.parse(JSON.stringify(p.stock || {})), lowAt: p.lowAt, order: p.order || 0, cost: undefined, changed: false }
        : { isNew: true, id: null, name: name.slice(0, 40), kind: null, price: 0, sizes: [], colours: [], stock: {}, lowAt: 2, order: Date.now() + Object.keys(plans).length, cost: undefined, changed: true });
      if (!plan.isNew && plan.name !== name.slice(0, 40)) { plan.name = name.slice(0, 40); plan.changed = true; }
      const kind = kindOf(get(r, C.kind));
      if (kind && kind !== plan.kind) { plan.kind = kind; plan.changed = true; }
      const priceTxt = get(r, C.price);
      if (priceTxt !== '' && parseEur(priceTxt) !== plan.price) { plan.price = parseEur(priceTxt); plan.changed = true; }
      const costTxt = get(r, C.cost);
      if (costTxt !== '' && isMgmt(bandId)) plan.cost = parseEur(costTxt);
      const size = (get(r, C.size) || 'One size').slice(0, 12);
      if (!plan.sizes.includes(size)) { plan.sizes.push(size); plan.changed = true; }
      const cname = get(r, C.colour).slice(0, 24);
      let c = plan.colours.find((x) => norm(x.name) === norm(cname)) || (!cname && plan.colours.length === 1 ? plan.colours[0] : null);
      if (!c) {
        const known = COLOURS.find(([n]) => norm(n) === norm(cname));
        c = { id: newColourId(), name: cname, hex: known ? known[1] : '#7D8189' };
        plan.colours.push(c);
        plan.changed = true;
      }
      [['van', C.van], ['storage', C.storage]].forEach(([loc, i]) => {
        const v = get(r, i);
        if (v === '') return;
        const n = Math.max(0, Math.round(parseEur(v)));
        const at = (((plan.stock[c.id] = plan.stock[c.id] || {})[loc] = plan.stock[c.id][loc] || {}));
        if (at[size] !== n) { at[size] = n; plan.changed = true; counts += 1; }
      });
    });
    const list = Object.values(plans).map((pl) => ({ ...pl, kind: pl.kind || 'other' }));
    return { list, counts, added: list.filter((x) => x.isNew).length, updated: list.filter((x) => !x.isNew && x.changed).length };
  }

  async function applyImport(bandId, plan) {
    const b = backend();
    for (const pl of plan.list) {
      if (!pl.changed && pl.cost === undefined) continue;
      const stock = {};
      pl.colours.forEach((c) => {
        stock[c.id] = {};
        ['van', 'storage'].forEach((l) => {
          stock[c.id][l] = {};
          pl.sizes.forEach((z) => { stock[c.id][l][z] = Math.max(0, Number(((pl.stock[c.id] || {})[l] || {})[z]) || 0); });
        });
      });
      const data = { name: pl.name, kind: pl.kind, price: pl.price, sizes: pl.sizes.slice(0, 12), colours: pl.colours.map(({ id, name, hex }) => ({ id, name, hex })), stock, lowAt: pl.lowAt, order: pl.order };
      const pid = pl.changed || pl.isNew ? await b.saveMerch(bandId, 'products', pl.id, data) : pl.id;
      if (pl.cost !== undefined) await b.saveMerch(bandId, 'costs', pid, { cost: pl.cost });
    }
  }

  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (!(t.matches && t.matches('input[type=file][data-import=stock]'))) return;
    const file = t.files && t.files[0];
    t.value = '';
    if (!file) return;
    const bandId = merchBand();
    try {
      const plan = planImport(bandId, await file.text());
      if (!plan.added && !plan.updated) { toast('Nothing to change: the file matches what\'s in the app.'); return; }
      const parts = [];
      if (plan.added) parts.push(`${plan.added} new ${plan.added === 1 ? 'product' : 'products'} (${plan.list.filter((x) => x.isNew).map((x) => x.name).join(', ')})`);
      if (plan.updated) parts.push(`${plan.updated} ${plan.updated === 1 ? 'product' : 'products'} updated`);
      if (plan.counts) parts.push(`${plan.counts} stock ${plan.counts === 1 ? 'number' : 'numbers'} changed`);
      if (!confirm(`Import into ${bandById(bandId).name}?\n\n${parts.join('\n')}\n\nProducts that aren't in the file stay as they are.`)) return;
      run(async () => { await applyImport(bandId, plan); toast('Import done.'); });
    } catch (err) {
      toast(err.message || 'Could not read that file.');
    }
  });

  // ---------- Forms ----------
  Object.assign(forms, {
    product: (f, form) => {
      const d = collectPd(form);
      const bandId = d.band;
      const sizes = parseSizes(d.sizesText);
      if (!d.name.trim()) { state.authError = 'Please give the product a name.'; state.formDirty = false; render(); return; }
      if (!sizes.length) { state.authError = 'Please add at least one size (or "One size").'; state.formDirty = false; render(); return; }
      const val = (src, cid, l, z) => Math.max(0, Number((((src || {})[cid] || {})[l] || {})[z]) || 0);
      const base = {
        name: d.name.trim().slice(0, 40), kind: d.kind, price: parseEur(d.price), sizes,
        colours: d.colours.map((c) => ({ id: c.id, name: String(c.name || '').trim().slice(0, 24), hex: c.hex })),
        lowAt: Math.max(0, Math.min(50, Math.round(Number(d.lowAt)) || 0)), order: d.order || Date.now()
      };
      const at = nowLocal();
      const note = String(d.logNote || '').trim().slice(0, 60);
      const entry = (pid, c, type, size, loc, n) => ({ id: backend().newId(), pid, type, cid: c.id, colour: String(c.name || '').trim(), size, loc, n, note: type === 'move' ? '' : note, at, ts: Date.now(), by: me.id, byName: me.name });
      run(async () => {
        const b = backend();
        let pid = d.id;
        if (!d.id) {
          // New product: save it with its stock; log what it starts with
          const stock = {};
          d.colours.forEach((c) => { stock[c.id] = {}; ['van', 'storage'].forEach((l) => { stock[c.id][l] = {}; sizes.forEach((z) => { stock[c.id][l][z] = val(d.stock, c.id, l, z); }); }); });
          pid = await b.saveMerch(bandId, 'products', null, { ...base, stock });
          const logs = [];
          d.colours.forEach((c) => ['van', 'storage'].forEach((l) => {
            const n = sizes.reduce((t, z) => t + val(d.stock, c.id, l, z), 0);
            if (n) logs.push(entry(pid, c, d.logType === 'delivery' ? 'delivery' : 'added', '', l, n));
          }));
          if (logs.length) await b.changeStock(bandId, [], null, { logs });
        } else {
          // Existing product: save the details, then change the stock by the difference
          // (so a sale made on another phone meanwhile isn't overwritten)
          await b.saveMerch(bandId, 'products', d.id, base, { merge: true });
          const moves = []; const logs = [];
          d.colours.forEach((c) => {
            let movedTotal = 0; const movedSizes = [];
            sizes.forEach((z) => {
              let dv = val(d.stock, c.id, 'van', z) - val(d.orig, c.id, 'van', z);
              let ds = val(d.stock, c.id, 'storage', z) - val(d.orig, c.id, 'storage', z);
              if (dv) moves.push({ pid, cid: c.id, loc: 'van', size: z, n: dv });
              if (ds) moves.push({ pid, cid: c.id, loc: 'storage', size: z, n: ds });
              if (dv > 0 && ds < 0) { const m = Math.min(dv, -ds); movedTotal += m; movedSizes.push(z); dv -= m; ds += m; }
              if (dv) logs.push(entry(pid, c, d.logType || 'edit', z, 'van', dv));
              if (ds) logs.push(entry(pid, c, d.logType || 'edit', z, 'storage', ds));
            });
            if (movedTotal) logs.push(entry(pid, c, 'move', movedSizes.length === 1 && sizes.length > 1 ? movedSizes[0] : (sizes.length === 1 ? sizes[0] : ''), 'van', movedTotal));
          });
          if (moves.length || logs.length) await b.changeStock(bandId, moves, null, { logs });
        }
        const cost = String(d.cost).trim() === '' ? null : parseEur(d.cost);
        await b.saveMerch(bandId, 'costs', pid, { cost });
        if (d.photoChanged) {
          if (d.photo) await b.saveMerch(bandId, 'photos', pid, { data: d.photo, pid });
          else if (d.id) await b.deleteItem(bandId, 'photos', pid);
          // old per-colour photos are no longer needed
          if (d.id) for (const old of merchOf(bandId, 'photos').filter((x) => x.id.startsWith(pid + '_'))) await b.deleteItem(bandId, 'photos', old.id);
        }
        state.pd = null;
        location.hash = '#/money';
        toast(d.id ? 'Saved.' : 'Product added.');
      });
    },
    bundle: (f, form) => {
      const bandId = merchBand();
      const items = f.getAll('items').map(String);
      const price = parseEur(f.get('price'));
      if (items.length < 2) { state.authError = 'Tick at least two products.'; state.formDirty = false; render(); return; }
      const names = Object.fromEntries(products(bandId).map((p) => [p.id, p.name]));
      const name = String(f.get('name') || '').trim() || items.map((i) => names[i]).join(' + ');
      run(async () => {
        await backend().saveMerch(bandId, 'bundles', form.dataset.id || null, { name: name.slice(0, 40), items, price });
        location.hash = '#/money';
        toast('Bundle saved.');
      });
    },
    night: (f, form) => saveNight(form, 'save')
  });

  // ---------- Typing & picking ----------
  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.matches && t.matches('input[type=file][data-photo]')) {
      const file = t.files && t.files[0];
      if (!file) return;
      const d = collectPd(pdForm());
      if (!d) return;
      toast('Shrinking the photo…');
      try {
        d.photo = await shrinkPhoto(file);
        d.photoChanged = true;
      } catch (err) { toast(err.message); }
      state.formDirty = false;
      render();
      return;
    }
    if (t.name === 'sellNight') {
      state.sellNight = { band: t.dataset.band, key: t.value };
      state.formDirty = false;
      render();
      return;
    }
    if ((t.name === 'kind' || t.name === 'sizesText') && t.closest('form[data-form="product"]')) {
      const before = state.pd ? { kind: state.pd.kind, sizes: state.pd.sizesText } : null;
      const d = collectPd(t.form);
      if (t.name === 'kind' && before && (before.sizes === SIZE_PRESETS[before.kind] || !before.sizes.trim())) d.sizesText = SIZE_PRESETS[d.kind] || 'One size';
      state.formDirty = false;
      setTimeout(render, 0); // not while the browser is still busy with the field
    }
  });

  document.addEventListener('input', (ev) => {
    const form = ev.target.closest && ev.target.closest('form[data-form="night"]');
    if (form) {
      const f = new FormData(form);
      const cash = Number(form.querySelector('.should').dataset.cash) || 0;
      const fl = parseEur(f.get('float'));
      const should = fl + cash;
      form.querySelector('.should').textContent = eur(should);
      const c = String(f.get('counted') || '').trim();
      form.querySelector('.diff').innerHTML = diffText(c === '' ? '' : parseEur(c), should);
      return;
    }
    const pf = ev.target.closest && ev.target.closest('form[data-form="product"]');
    if (pf && /^st_/.test(ev.target.name || '')) { refreshPd(); return; }
    if (pf && (ev.target.name === 'price' || ev.target.name === 'cost')) {
      const f = new FormData(pf);
      const el = pf.querySelector('.profit-line');
      if (el) el.textContent = profitText(f.get('price'), f.get('cost'));
    }
  });
}

export { bandById, summary, nightSales, nightDoc };
