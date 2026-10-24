// BAND — invite link, members & roles, name & colour (MGMT), leave band.
import { state, me, bands, isMgmt, membersOf } from '../store.js';
import { esc } from '../utils.js';
import { icons } from '../icons.js';
import { colorPicker } from './auth.js';

export function inviteUrl(code) {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  u.searchParams.set('invite', code);
  const keep = new URLSearchParams(location.search);
  if (keep.has('mock')) u.searchParams.set('mock', '1');
  return u.toString();
}

export function renderBand(id) {
  const b = bands.find((x) => x.id === id);
  if (!b) {
    return `<header class="head"><div class="topbar"><a class="icon-btn back" href="#/me" aria-label="Back">${icons.chevronLeft()}</a></div></header>
      <main id="main"><div class="empty">This band isn't available.</div></main>`;
  }
  const mgmt = isMgmt(b.id);
  const members = membersOf(b.id);
  const mgmtCount = members.filter((m) => m.role === 'mgmt').length;

  const invite = mgmt ? `<section class="card pad stack-8" aria-label="Invite">
      <h2 class="h2">Invite people</h2>
      ${b.inviteCode ? `
        <p class="muted small">Send this link to your bandmates (WhatsApp, email…). Anyone with the link can join as a member.</p>
        <input class="invite-url" type="text" readonly value="${esc(inviteUrl(b.inviteCode))}" aria-label="Invite link">
        <div class="btn-row">
          <button type="button" class="btn-primary" data-action="share-invite" data-band="${esc(b.id)}">${navigator.share ? 'Share link' : 'Copy link'}</button>
          ${navigator.share ? `<button type="button" class="btn-outline" data-action="copy-invite" data-band="${esc(b.id)}">Copy</button>` : ''}
        </div>
        <button type="button" class="link-btn muted" data-action="new-invite" data-band="${esc(b.id)}">Make a new link (the old one stops working)</button>`
      : `<p class="muted small">Create a link and send it to your bandmates. They open it, sign in and they're in.</p>
         <button type="button" class="btn-primary" data-action="new-invite" data-band="${esc(b.id)}" ${state.busy ? 'disabled' : ''}>Create invite link</button>`}
    </section>` : `<p class="muted small">Ask the band's MGMT for an invite link if someone else should join.</p>`;

  const rows = members.map((m) => {
    const self = m.uid === me.id;
    const actions = mgmt && !self ? `<div class="btn-row small-row">
        <button type="button" class="btn-small" data-action="set-role" data-band="${esc(b.id)}" data-uid="${esc(m.uid)}" data-role="${m.role === 'mgmt' ? 'member' : 'mgmt'}">${m.role === 'mgmt' ? 'Make member' : 'Make MGMT'}</button>
        <button type="button" class="btn-small danger" data-action="remove-member" data-band="${esc(b.id)}" data-uid="${esc(m.uid)}" data-name="${esc(m.name || '')}">Remove</button>
      </div>` : '';
    return `<div class="person col">
      <div class="row-inline">
        <span class="avatar" aria-hidden="true">${esc((m.name || '?')[0].toUpperCase())}</span>
        <span class="stack-2 grow"><span class="person-name">${esc(m.name || 'Someone')}${self ? ' (you)' : ''}</span><span class="muted small">${esc(m.instrument || '')}</span></span>
        <span class="tag-plain">${m.role === 'mgmt' ? 'MGMT' : 'Member'}</span>
      </div>${actions}
    </div>`;
  }).join('');

  const settings = mgmt ? `<details class="sec">
      <summary><span class="sec-title">Name &amp; colour</span>${icons.chevronDown(18)}</summary>
      <div class="sec-body"><form data-form="band-settings" data-band="${esc(b.id)}" class="form">
        <label class="lbl">Band name<input type="text" name="name" required maxlength="40" value="${esc(b.name)}"></label>
        ${colorPicker(b.color)}
        <button class="btn-primary" type="submit">Save</button>
      </form></div>
    </details>` : '';

  const leaveBlocked = mgmt && mgmtCount <= 1 && members.length > 1;
  return `<header class="head" style="--band:${esc(b.color)}">
      <div class="topbar">
        <a class="icon-btn back" href="#/me" aria-label="Back">${icons.chevronLeft()}</a>
        <span class="tag" style="background:${esc(b.color)};color:${esc(b.ink)}">${mgmt ? 'You are MGMT' : 'Member'}</span>
      </div>
      <div class="title-row"><h1>${esc(b.name)}</h1></div>
    </header>
    <main id="main">
      ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
      ${state.authInfo ? `<p class="form-info" role="status">${esc(state.authInfo)}</p>` : ''}
      ${invite}
      <h2 class="section-h">Members · ${members.length}</h2>
      ${rows}
      ${settings}
      ${leaveBlocked
        ? '<p class="muted small">You\'re the only MGMT. Make someone else MGMT before you leave this band.</p>'
        : `<button type="button" class="btn-outline danger" data-action="leave-band" data-band="${esc(b.id)}" data-name="${esc(b.name)}">Leave ${esc(b.name)}</button>`}
    </main>`;
}
