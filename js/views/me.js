// PROFILE — my name, my bands, create a band, sign out.
import { state, me, bands, isMgmt, membersOf, roleName } from '../store.js';
import { esc } from '../utils.js';
import { icons } from '../icons.js';
import { instrumentOptions, createBandForm } from './auth.js';

export function renderMe() {
  const bandRows = bands.map((b) => `<a class="person" href="#/band/${esc(b.id)}">
      <span class="sheet-dot" style="background:${esc(b.color)}" aria-hidden="true"></span>
      <span class="stack-2 grow"><span class="person-name">${esc(b.name)}</span>
      <span class="muted small">${roleName(b.id, me.id, me.bands[b.id])} · ${membersOf(b.id).length} people</span></span>
      ${icons.chevronRight(18)}
    </a>`).join('');

  return `<header class="head">
      <div class="topbar">
        <a class="icon-btn back" href="#/today" aria-label="Back">${icons.chevronLeft()}</a>
        <span class="muted small">${esc(me.email || '')}</span>
      </div>
      <div class="title-row"><h1>Profile &amp; bands</h1></div>
    </header>
    <main id="main">
      ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
      ${state.authInfo ? `<p class="form-info" role="status">${esc(state.authInfo)}</p>` : ''}
      <form data-form="profile" class="form card pad">
        <h2 class="h2">Me</h2>
        <label class="lbl">Name<input type="text" name="name" required maxlength="40" value="${esc(me.name)}"></label>
        <label class="lbl">Instrument / role${instrumentOptions(me.instrument)}</label>
        <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Save</button>
      </form>

      <h2 class="section-h">My bands</h2>
      ${bandRows || '<div class="empty">No bands yet.</div>'}
      <p class="muted small">Open a band to invite people${bands.some((b) => isMgmt(b.id)) ? ', change roles or edit its name and colour' : ''}.</p>

      <details class="sec">
        <summary><span class="sec-title">${icons.plus()} Create another band</span>${icons.chevronDown(18)}</summary>
        <div class="sec-body">${createBandForm('New band')}</div>
      </details>

      <button type="button" class="btn-outline" data-action="sign-out">Sign out</button>
      <p class="app-version muted small" id="app-version"></p>
    </main>`;
}
