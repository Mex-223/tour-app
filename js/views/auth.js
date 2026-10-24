// Screens before the app: loading, login, first-time profile, joining a band, no band yet.
import { state, me } from '../store.js';
import { PALETTE, INSTRUMENTS } from '../data.js';
import { esc } from '../utils.js';
import { icons } from '../icons.js';

const logo = `<span class="logo" aria-hidden="true"><i style="background:#F5A524;width:70%"></i><i style="background:#5B8CFF;width:52%"></i><i style="background:#E46AA8;width:60%"></i></span>`;

function msg() {
  return `${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}${state.authInfo ? `<p class="form-info" role="status">${esc(state.authInfo)}</p>` : ''}`;
}

export function renderSplash(text = 'Loading…') {
  return `<main id="main" class="center-screen">${logo}<p class="muted">${esc(text)}</p></main>`;
}

export function renderBackendError() {
  return `<main id="main" class="center-screen">${logo}
    <h1>Can't connect</h1>
    <p class="muted center">The app needs an internet connection the very first time it opens. Check your signal and try again.</p>
    <button type="button" class="btn-primary" data-action="reload">Try again</button>
  </main>`;
}

export function renderLogin() {
  const mode = state.authMode || 'signin';
  const invite = state.pendingInvite ? `<p class="form-info">You've been invited to join a band. Sign in or create an account to continue.</p>` : '';
  if (mode === 'reset') {
    return `<main id="main" class="auth">
      ${logo}<h1>Reset password</h1>
      <p class="muted">We'll email you a link to set a new password.</p>
      ${msg()}
      <form data-form="reset" class="form">
        <label class="lbl">Email<input type="email" name="email" autocomplete="email" required></label>
        <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Send link</button>
      </form>
      <button type="button" class="link-btn" data-action="auth-mode" data-mode="signin">Back to sign in</button>
    </main>`;
  }
  const signup = mode === 'signup';
  return `<main id="main" class="auth">
    ${logo}<h1>${signup ? 'Create account' : 'Tour App'}</h1>
    <p class="muted">${signup ? 'One account for all your bands.' : 'Shows, rehearsals and contacts for all your bands.'}</p>
    ${invite}${msg()}
    <button type="button" class="btn-google" data-action="google" ${state.busy ? 'disabled' : ''}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      Continue with Google
    </button>
    <div class="or"><span>or with email</span></div>
    <form data-form="${signup ? 'signup' : 'signin'}" class="form">
      ${signup ? '<label class="lbl">Your name<input type="text" name="name" autocomplete="name" required maxlength="40"></label>' : ''}
      <label class="lbl">Email<input type="email" name="email" autocomplete="email" required></label>
      <label class="lbl">Password<input type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="6"></label>
      <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${signup ? 'Create account' : 'Sign in'}</button>
    </form>
    ${signup
      ? '<button type="button" class="link-btn" data-action="auth-mode" data-mode="signin">I already have an account</button>'
      : `<button type="button" class="link-btn" data-action="auth-mode" data-mode="signup">New here? Create an account</button>
         <button type="button" class="link-btn muted" data-action="auth-mode" data-mode="reset">Forgot password?</button>`}
  </main>`;
}

function instrumentOptions(current) {
  return `<datalist id="instruments">${INSTRUMENTS.map((i) => `<option value="${esc(i)}"></option>`).join('')}</datalist>
    <input type="text" name="instrument" list="instruments" maxlength="40" value="${esc(current || '')}" placeholder="e.g. Drums">`;
}

export function renderSetup() {
  const suggested = me.name || (state.user && state.user.displayName) || '';
  return `<main id="main" class="auth">
    ${logo}<h1>Welcome!</h1>
    <p class="muted">How should your bandmates see you?</p>
    ${msg()}
    <form data-form="setup" class="form">
      <label class="lbl">Name<input type="text" name="name" required maxlength="40" value="${esc(suggested)}" autocomplete="nickname"></label>
      <label class="lbl">Instrument / role${instrumentOptions(me.instrument)}</label>
      <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Continue</button>
    </form>
  </main>`;
}

export function renderJoin(invite) {
  if (invite === undefined) return renderSplash('Checking invite…');
  if (!invite) {
    return `<main id="main" class="auth">${logo}<h1>Invite not valid</h1>
      <p class="muted">This invite link doesn't work anymore. Ask your MGMT for a new one.</p>
      <button type="button" class="btn-primary" data-action="dismiss-invite">OK</button></main>`;
  }
  return `<main id="main" class="auth">${logo}
    <h1>Join ${esc(invite.bandName)}?</h1>
    <p class="muted">You'll see the band's schedule, rehearsals and contacts. MGMT can make you MGMT later.</p>
    ${msg()}
    <button type="button" class="btn-primary" data-action="join-band" ${state.busy ? 'disabled' : ''}>Join ${esc(invite.bandName)}</button>
    <button type="button" class="link-btn" data-action="dismiss-invite">Not now</button>
  </main>`;
}

export function colorPicker(selected) {
  return `<fieldset class="swatches"><legend class="lbl-text">Colour</legend>${PALETTE.map((p, i) => {
    const on = selected ? p.color.toLowerCase() === selected.toLowerCase() : i === 0;
    return `<label class="swatch" title="${esc(p.name)}"><input type="radio" name="color" value="${esc(p.color)}" ${on ? 'checked' : ''}><span style="background:${esc(p.color)}" aria-hidden="true"></span><span class="sr">${esc(p.name)}</span></label>`;
  }).join('')}</fieldset>`;
}

export function createBandForm(title = 'Create a band') {
  return `<form data-form="create-band" class="form card pad">
    <h2 class="h2">${esc(title)}</h2>
    <label class="lbl">Band name<input type="text" name="name" required maxlength="40" placeholder="e.g. HFAR"></label>
    ${colorPicker()}
    <p class="muted small">You'll be MGMT of this band: you can plan events and invite the others.</p>
    <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Create band</button>
  </form>`;
}

export function joinCodeForm() {
  return `<form data-form="join-code" class="form card pad">
    <h2 class="h2">Got an invite?</h2>
    <p class="muted small">Paste the invite link your band's MGMT sent you (WhatsApp, email…).</p>
    <label class="lbl">Invite link or code<input type="text" name="code" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://mex-223.github.io/tour-app/?invite=…"></label>
    <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>Join band</button>
  </form>`;
}

export function renderWelcome() {
  return `<main id="main" class="auth wide">
    ${logo}<h1>Hi ${esc(me.name)}!</h1>
    <p class="muted">You're not in a band in the app yet.</p>
    ${msg()}
    ${joinCodeForm()}
    <p class="muted small">No link? Ask whoever manages your band in the app to send you one (Profile → band → Invite people).</p>
    <details class="sec">
      <summary><span class="sec-title">Start a new band instead</span>${icons.chevronDown(18)}</summary>
      <div class="sec-body">
        <p class="form-info">Only if your band isn't in the app yet. If a bandmate already created it, ask them for the invite link, otherwise you'll end up with two copies of the same band.</p>
        ${createBandForm('New band')}
      </div>
    </details>
    <button type="button" class="link-btn muted" data-action="sign-out">${icons.close(16)} Sign out</button>
  </main>`;
}

export { instrumentOptions };
