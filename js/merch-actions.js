// Merch: what happens when you tap, type or save on the merch screens.
import { state, me, bandById } from './store.js';
import {
  merchBand, products, productById, parseEur, parseSizes, bundleDiscount, refillHints, salesOf, SIZE_PRESETS, COLOURS
} from './merch.js';
import { cartFor, currentNight, newColourId, diffText, nightText, profitText } from './views/merch.js';
import { nightSales, summary, nightDoc } from './merch.js';
import { shrinkPhoto } from './photo.js';
import { eur } from './merch.js';

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

  // ---------- Taps ----------
  Object.assign(actions, {
    'merch-band': (el) => { state.merchBand = el.dataset.band; state.cart = null; state.pick = null; },
    'stock-loc': (el) => { state.stockLoc = el.dataset.loc; },
    'sell-loc': (el) => { state.sellLoc = el.dataset.loc; },
    'sell-pay': (el) => { state.sellPay = el.dataset.pay; },
    'sell-tap': (el) => {
      const bandId = merchBand();
      const p = productById(bandId, el.dataset.pid);
      if (!p) return 'none';
      if (p.sizes.length > 1) { state.pick = { pid: p.id, cid: el.dataset.cid }; return undefined; }
      addToCart(bandId, p, el.dataset.cid, p.sizes[0]);
      return undefined;
    },
    'pick-size': (el) => {
      const bandId = merchBand();
      const p = state.pick && productById(bandId, state.pick.pid);
      if (p) addToCart(bandId, p, state.pick.cid, el.dataset.size);
      state.pick = null;
    },
    'pick-close': () => { state.pick = null; },
    'cart-remove': (el) => { const c = cartFor(merchBand()); c.items.splice(Number(el.dataset.i), 1); },
    charge: () => {
      const bandId = merchBand();
      const cart = cartFor(bandId);
      if (!cart.items.length) return 'none';
      const { discount } = bundleDiscount(bandId, cart.items);
      const total = Math.round((cart.items.reduce((s, i) => s + i.price, 0) - discount) * 100) / 100;
      const key = currentNight(bandId);
      const loc = state.sellLoc || 'van';
      const pay = state.sellPay || 'card';
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const ev = key.startsWith('d-') ? null : key;
      const sale = {
        at: local, date: key.startsWith('d-') ? key.slice(2) : local.slice(0, 10), eventId: ev, night: key,
        by: me.id, byName: me.name, pay, loc, items: cart.items.map((i) => ({ ...i })), discount, total
      };
      const moves = cart.items.map((i) => ({ pid: i.pid, cid: i.cid, loc, size: i.size, n: -1 }));
      const id = backend().newId();
      state.cart = { band: bandId, items: [] };
      state.lastSaleText = `Sale saved: ${eur(total)} · ${pay}. Tap a product for the next one.`;
      backend().recordSale(bandId, id, sale, moves).catch((err) => toast(err.message || 'Could not save the sale.'));
      toast(`Sold · ${eur(total)} ${pay}`);
      return undefined;
    },
    'undo-sale': (el) => {
      const bandId = merchBand();
      const s = salesOf(bandId).find((x) => x.id === el.dataset.id);
      if (!s || !confirm(`Undo this sale (${eur(s.total)})? The items go back into stock.`)) return 'none';
      run(async () => { await backend().undoSale(bandId, s.id, backMoves(bandId, [s])); toast('Sale undone. The items are back in stock.'); });
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
        await backend().deleteNight(bandId, key, list.map((x) => x.id), backMoves(bandId, list));
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
      run(async () => { await backend().changeStock(bandId, list); toast('Stock updated: moved to the van box.'); });
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
      return 'none';
    },
    'pd-cancel': () => { state.pd = null; return 'nav'; },
    'pd-colour-add': () => {
      const d = collectPd(pdForm());
      const used = d.colours.map((c) => c.hex);
      const [name, hex] = COLOURS.find(([, h]) => !used.includes(h)) || COLOURS[0];
      d.colours.push({ id: newColourId(), name, hex, photo: null, photoChanged: false });
      state.formDirty = false;
    },
    'pd-colour-remove': (el) => {
      const d = collectPd(pdForm());
      if (!confirm('Remove this colour with its photo and stock?')) return 'none';
      d.removed = [...(d.removed || []), el.dataset.cid];
      d.colours = d.colours.filter((c) => c.id !== el.dataset.cid);
      delete d.stock[el.dataset.cid];
      state.formDirty = false;
      return undefined;
    },
    'pd-photo-remove': (el) => {
      const d = collectPd(pdForm());
      const c = d.colours.find((x) => x.id === el.dataset.cid);
      if (c) { c.photo = null; c.photoChanged = true; }
      state.formDirty = false;
    },
    'pd-delete': () => {
      const d = state.pd;
      if (!d || !d.id || !confirm(`Delete "${d.name || 'this product'}"? Past sales stay in the reports.`)) return 'none';
      run(async () => {
        await backend().deleteProduct(d.band, d.id, d.colours.map((c) => `${d.id}_${c.id}`));
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
    return sales.flatMap((x) => x.items.filter((i) => ids.has(i.pid)).map((i) => ({ pid: i.pid, cid: i.cid, loc: x.loc || 'van', size: i.size, n: 1 })));
  }

  function addToCart(bandId, p, cid, size) {
    const c = p.colours.find((x) => x.id === cid) || p.colours[0];
    cartFor(bandId).items.push({ pid: p.id, cid: c.id, size, name: p.name, colour: p.colours.length > 1 ? (c.name || '') : '', price: p.price });
    state.lastSaleText = '';
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

  // ---------- Forms ----------
  Object.assign(forms, {
    product: (f, form) => {
      const d = collectPd(form);
      const bandId = d.band;
      const sizes = parseSizes(d.sizesText);
      if (!d.name.trim()) { state.authError = 'Please give the product a name.'; state.formDirty = false; render(); return; }
      if (!sizes.length) { state.authError = 'Please add at least one size (or "One size").'; state.formDirty = false; render(); return; }
      const stock = {};
      d.colours.forEach((c) => {
        stock[c.id] = {};
        ['van', 'storage'].forEach((l) => {
          stock[c.id][l] = {};
          sizes.forEach((z) => { stock[c.id][l][z] = Math.max(0, Number(((d.stock[c.id] || {})[l] || {})[z]) || 0); });
        });
      });
      const data = {
        name: d.name.trim().slice(0, 40), kind: d.kind, price: parseEur(d.price), sizes,
        colours: d.colours.map((c) => ({ id: c.id, name: String(c.name || '').trim().slice(0, 24), hex: c.hex })),
        stock, lowAt: Math.max(0, Math.min(50, Math.round(Number(d.lowAt)) || 0)), order: d.order || Date.now()
      };
      run(async () => {
        const b = backend();
        const pid = await b.saveMerch(bandId, 'products', d.id, data);
        const cost = String(d.cost).trim() === '' ? null : parseEur(d.cost);
        await b.saveMerch(bandId, 'costs', pid, { cost });
        for (const c of d.colours) {
          if (c.photoChanged && c.photo) await b.saveMerch(bandId, 'photos', `${pid}_${c.id}`, { data: c.photo, pid });
          if (c.photoChanged && !c.photo && d.id) await b.deleteItem(bandId, 'photos', `${pid}_${c.id}`);
        }
        for (const gone of d.removed || []) if (d.id) await b.deleteItem(bandId, 'photos', `${pid}_${gone}`);
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
      const c = d && d.colours.find((x) => x.id === t.dataset.photo);
      if (!c) return;
      toast('Shrinking the photo…');
      try {
        c.photo = await shrinkPhoto(file);
        c.photoChanged = true;
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
      render();
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
    if (pf && (ev.target.name === 'price' || ev.target.name === 'cost')) {
      const f = new FormData(pf);
      const el = pf.querySelector('.profit-line');
      if (el) el.textContent = profitText(f.get('price'), f.get('cost'));
    }
  });
}

export { bandById, summary, nightSales, nightDoc };
