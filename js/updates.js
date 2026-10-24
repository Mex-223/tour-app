// Optional updates: shows "New version ready · Update / Later" when a new
// version has been downloaded in the background. Nothing changes until Update is tapped.

let banner;
let waitingWorker = null;
let dismissed = false;
let reloading = false;

function askVersion(worker) {
  return new Promise((resolve) => {
    if (!worker) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

async function show(worker) {
  waitingWorker = worker;
  if (dismissed || !banner) return;
  const info = await askVersion(worker);
  const title = info ? `Version ${info.version} is ready` : 'A new version is ready';
  banner.innerHTML = `
    <div class="upd-text"><strong>${escapeText(title)}</strong>${info && info.notes ? `<span>${escapeText(info.notes)}</span>` : ''}</div>
    <div class="upd-actions">
      <button type="button" class="upd-later" data-upd="later">Later</button>
      <button type="button" class="upd-now" data-upd="now">Update</button>
    </div>`;
  banner.hidden = false;
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function watch(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      // "installed" while an older version is running = an update is waiting
      if (nw.state === 'installed' && navigator.serviceWorker.controller) show(nw);
    });
  });
}

// The version this phone is running right now (for showing in the app).
export async function currentVersion() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return null;
  const info = await askVersion(navigator.serviceWorker.controller);
  return info ? info.version : null;
}

export function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  banner = document.getElementById('update');
  banner.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upd]');
    if (!btn) return;
    if (btn.dataset.upd === 'later') {
      dismissed = true; // ask again next time the app is opened
      banner.hidden = true;
    } else if (waitingWorker) {
      btn.disabled = true;
      btn.textContent = 'Updating…';
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      watch(reg);
      // Look for a new version when the app comes back to the foreground (at most every 30 min).
      let last = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - last > 30 * 60 * 1000) {
          last = Date.now();
          reg.update().catch(() => {});
        }
      });
    }).catch(() => { /* offline mode not available */ });
  });
}
