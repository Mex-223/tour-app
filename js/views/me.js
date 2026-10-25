// PROFILE — my name, my bands, create a band, sign out.
import { state, me, bands, isMgmt, membersOf, roleName, myAway } from '../store.js';
import { esc, fmtDay, todayISO } from '../utils.js';
import { icons } from '../icons.js';
import { instrumentOptions, createBandForm } from './auth.js';
import { availableNavApps, getNavApp } from '../nav.js';

function awayList() {
  const today = todayISO();
  const list = myAway().filter((a) => a.to >= today);
  if (!list.length) return '<div class="empty">No dates yet.</div>';
  return list.map((a) => `<div class="person">
      <span class="stack-2 grow"><span class="person-name">${esc(fmtDay(a.from))}${a.to !== a.from ? ' – ' + esc(fmtDay(a.to)) : ''}</span>
      <span class="muted small">${esc(a.note || 'Not available')}</span></span>
      <button type="button" class="btn-small danger" data-action="remove-away" data-id="${esc(a.id)}" data-bands="${esc(a.bands.join(','))}">Remove</button>
    </div>`).join('');
}

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
        <label class="lbl">Phone (your bandmates can see it)<input type="tel" name="phone" maxlength="30" value="${esc(me.phone || '')}" placeholder="+43 …"></label>
        <label class="check"><input type="checkbox" name="sharePhone" ${me.sharePhone ? 'checked' : ''}><span>My number may appear in guest PDFs (support bands, crew)</span></label>
        <label class="lbl">Navigation app on this device<select name="navApp">
          <option value="" ${!getNavApp() ? 'selected' : ''}>Ask every time</option>
          ${availableNavApps().map((a) => `<option value="${a.id}" ${getNavApp() === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select></label>
        <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Save</button>
      </form>

      <section class="card pad stack-8" aria-label="Not available">
        <h2 class="h2">When I'm not available</h2>
        <p class="muted small">Holidays, work, other gigs… All your bands see these days, and MGMT get a warning when they plan something then.</p>
        ${awayList()}
        <details class="sec">
          <summary><span class="sec-title">${icons.plus()} Add dates</span>${icons.chevronDown(18)}</summary>
          <div class="sec-body"><form data-form="away-add" class="form">
            <div class="grid-2">
              <label class="lbl">From<input type="date" name="from" required value="${esc(todayISO())}"></label>
              <label class="lbl">To (optional)<input type="date" name="to"></label>
            </div>
            <label class="lbl">Reason (optional, the band sees it)<input type="text" name="note" maxlength="60" placeholder="e.g. Holiday, work, other gig"></label>
            <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Save</button>
          </form></div>
        </details>
      </section>

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
