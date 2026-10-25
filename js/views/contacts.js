// CONTACT FORM — add / edit a team contact (MGMT only).
import { state, bands, isMgmt, mgmtBands, bandById, CONTACT_ROLES } from '../store.js';
import { esc } from '../utils.js';
import { icons } from '../icons.js';

export function renderContactForm(bandId, id) {
  const isNew = !id || id === 'new';
  const list = state.contactLists[bandId] || [];
  const c = isNew ? { role: 'Tour manager', share: true } : list.find((x) => x.id === id);
  const head = (title) => `<header class="head">
      <div class="topbar">
        <a class="link-btn" href="#/people">Cancel</a>
        <span class="muted small">${isNew ? 'New contact' : 'Edit contact'}</span>
      </div>
      <div class="title-row"><h1>${esc(title)}</h1></div>
    </header>`;
  if (!bands.some((b) => b.id === bandId) || !isMgmt(bandId) || !c) {
    return head('Not available') + `<main id="main"><div class="empty">${!c ? 'This contact doesn\'t exist anymore.' : 'Only MGMT can add or change team contacts.'}</div></main>`;
  }
  const options = mgmtBands();
  const bandField = isNew && options.length > 1
    ? `<label class="lbl">Band<select name="band">${options.map((b) => `<option value="${esc(b.id)}" ${b.id === bandId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`
    : `<input type="hidden" name="band" value="${esc(bandId)}"><p class="muted small">Band: <strong style="color:${esc(bandById(bandId).color)}">${esc(bandById(bandId).name)}</strong></p>`;
  return head(isNew ? 'New contact' : (c.name || 'Contact')) + `<main id="main">
    ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
    <form data-form="contact" data-id="${esc(isNew ? '' : id)}" data-band="${esc(bandId)}" class="form">
      ${bandField}
      <label class="lbl">Role<select name="role">${CONTACT_ROLES.map((r) => `<option ${r === c.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="lbl">Name<input type="text" name="name" required maxlength="60" value="${esc(c.name || '')}" placeholder="e.g. Lena Huber, or Booking Agency XY"></label>
      <label class="lbl">Phone<input type="tel" name="phone" maxlength="30" value="${esc(c.phone || '')}" placeholder="+43 …"></label>
      <label class="lbl">Email<input type="email" name="email" maxlength="80" value="${esc(c.email || '')}"></label>
      <label class="lbl">Note (optional)<input type="text" name="note" maxlength="80" value="${esc(c.note || '')}" placeholder="e.g. day-to-day questions, after 14:00"></label>
      <label class="check"><input type="checkbox" name="share" ${c.share !== false ? 'checked' : ''}><span>May appear in guest PDFs (support bands, crew, promoters)</span></label>
      <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${isNew ? 'Add contact' : 'Save'}</button>
      ${isNew ? '' : `<button type="button" class="btn-outline danger" data-action="delete-contact" data-band="${esc(bandId)}" data-id="${esc(id)}">${icons.close(16)} Delete contact</button>`}
    </form>
  </main>`;
}
