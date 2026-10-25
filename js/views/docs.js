// DOCS — links to riders, stage plots, contracts… plus the guest PDF export.
import { state, viewBands, bandById, isMgmt, mgmtBands, docsOf, DOC_CATEGORIES } from '../store.js';
import { topBar, bandTag } from '../components.js';
import { esc } from '../utils.js';
import { icons } from '../icons.js';

const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'Link'; } };

export function renderDocs() {
  const vb = viewBands();
  const canEdit = mgmtBands().filter((b) => vb.some((v) => v.id === b.id));
  const all = vb.flatMap((b) => docsOf(b.id));

  const groups = DOC_CATEGORIES.map((cat) => [cat, all.filter((d) => (d.category || 'Other') === cat)]).filter(([, l]) => l.length);
  const list = groups.map(([cat, l]) => `<h2 class="section-h">${esc(cat)}</h2>${l.map((d) => {
    const url = safeUrl(d.url);
    return `<div class="person">
      <span class="doc-ico" aria-hidden="true">${icons.docs(20)}</span>
      <span class="stack-2 grow">
        ${url ? `<a class="person-name doc-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(d.title || 'Document')}</a>` : `<span class="person-name">${esc(d.title || 'Document')}</span>`}
        <span class="muted small">${d.private ? `${icons.lock(12)} MGMT only · ` : ''}${esc(d.note || (url ? host(url) : 'No link'))}</span>
      </span>
      ${vb.length > 1 ? bandTag(d.band) : ''}
      ${isMgmt(d.band) ? `<a class="btn-small" href="#/doc/${esc(d.band)}/${esc(d.id)}${d.private ? '/p' : ''}">Edit</a>` : ''}
    </div>`;
  }).join('')}`).join('');

  const pdfCard = mgmtBands().length ? `<a class="card pad pdf-card" href="#/export">
      <span class="pdf-ico" aria-hidden="true">${icons.docs(26)}</span>
      <span class="stack-2 grow"><span class="h2">Guest PDF</span><span class="muted small">Tour info for a support band, crew, promoter or driver: times, venues, hotel, contacts. No fees or money.</span></span>
      ${icons.chevronRight(20)}
    </a>` : '';

  return `<header class="head">
      ${topBar()}
      <div class="title-row"><h1>Docs</h1></div>
    </header>
    <main id="main">
      ${pdfCard}
      ${list || `<div class="empty">No documents yet.${canEdit.length ? ' Add links to your rider, stage plot or input list, e.g. from Google Drive or Dropbox.' : ' MGMT can add riders, stage plots and other documents here.'}</div>`}
      ${canEdit.length ? `<a class="btn-outline" href="#/doc/${esc(canEdit[0].id)}/new">${icons.plus()} Add document link</a>` : ''}
      <p class="muted small">Tip: in Google Drive or Dropbox, use "Share → Copy link" and paste it here. Anyone in the band can then open it.</p>
    </main>`;
}

export function renderDocForm(bandId, id, priv) {
  const isNew = !id || id === 'new';
  const src = priv ? state.privateDocLists[bandId] : state.docLists[bandId];
  const d = isNew ? { category: 'Rider' } : (src || []).find((x) => x.id === id);
  const head = (title) => `<header class="head">
      <div class="topbar"><a class="link-btn" href="#/docs">Cancel</a><span class="muted small">${isNew ? 'New document' : 'Edit document'}</span></div>
      <div class="title-row"><h1>${esc(title)}</h1></div>
    </header>`;
  if (!isMgmt(bandId) || !d) {
    return head('Not available') + `<main id="main"><div class="empty">${!d ? 'This document doesn\'t exist anymore.' : 'Only MGMT can add or change documents.'}</div></main>`;
  }
  const options = mgmtBands();
  const bandField = isNew && options.length > 1
    ? `<label class="lbl">Band<select name="band">${options.map((b) => `<option value="${esc(b.id)}" ${b.id === bandId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`
    : `<input type="hidden" name="band" value="${esc(bandId)}"><p class="muted small">Band: <strong style="color:${esc(bandById(bandId).color)}">${esc(bandById(bandId).name)}</strong></p>`;
  return head(isNew ? 'Add document link' : (d.title || 'Document')) + `<main id="main">
    ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
    <form data-form="doc" data-id="${esc(isNew ? '' : id)}" data-band="${esc(bandId)}" data-private="${priv ? '1' : ''}" class="form">
      ${bandField}
      <label class="lbl">Type<select name="category">${DOC_CATEGORIES.map((c) => `<option ${c === d.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="lbl">Title<input type="text" name="title" required maxlength="80" value="${esc(d.title || '')}" placeholder="e.g. Tech rider 2026"></label>
      <label class="lbl">Link<input type="text" inputmode="url" name="url" required maxlength="500" value="${esc(d.url || '')}" placeholder="https://drive.google.com/…" autocapitalize="off" spellcheck="false"></label>
      <label class="lbl">Note (optional)<input type="text" name="note" maxlength="80" value="${esc(d.note || '')}" placeholder="e.g. version from October"></label>
      <label class="check"><input type="checkbox" name="private" ${priv ? 'checked' : ''}><span>MGMT only (contracts, deals, insurance)</span></label>
      <label class="check"><input type="checkbox" name="guest" ${d.guest ? 'checked' : ''}><span>Offer it in guest PDFs (riders, stage plots)</span></label>
      <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${isNew ? 'Add' : 'Save'}</button>
      ${isNew ? '' : `<button type="button" class="btn-outline danger" data-action="delete-doc" data-band="${esc(bandId)}" data-id="${esc(id)}" data-private="${priv ? '1' : ''}">${icons.close(16)} Delete</button>`}
    </form>
  </main>`;
}
