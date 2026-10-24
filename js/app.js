// Entry point: picks the screen from the address (#/today, #/schedule, ...),
// draws it, and handles taps.
import { state, savePrefs } from './store.js';
import { bottomNav, sheet } from './components.js';
import { renderToday } from './views/today.js';
import { renderSchedule, shiftMonth, gotoDate } from './views/schedule.js';
import { renderDay } from './views/day.js';
import { renderPeople } from './views/people.js';
import { renderLater } from './views/later.js';
import { initUpdates, currentVersion } from './updates.js';

const app = document.getElementById('app');
const TABS = ['today', 'schedule', 'people', 'money', 'docs'];

function currentRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const name = parts[0] || 'today';
  return { name, arg: parts[1] };
}

let lastHash = null;

function render() {
  const { name, arg } = currentRoute();
  const oldMain = document.getElementById('main');
  const keepScroll = lastHash === location.hash && oldMain ? oldMain.scrollTop : 0;

  let screen;
  if (name === 'schedule') screen = renderSchedule();
  else if (name === 'day') screen = renderDay(arg);
  else if (name === 'people') screen = renderPeople();
  else if (name === 'money' || name === 'docs') screen = renderLater(name);
  else screen = renderToday();

  const tab = name === 'day' ? 'schedule' : (TABS.includes(name) ? name : 'today');
  app.innerHTML = screen + bottomNav(tab) + sheet();

  const main = document.getElementById('main');
  if (main) main.scrollTop = keepScroll;

  const vEl = document.getElementById('app-version');
  if (vEl) currentVersion().then((v) => { if (v && vEl.isConnected) vEl.textContent = `App version ${v}`; });
  lastHash = location.hash;

  if (state.sheetOpen) {
    const first = app.querySelector('.sheet-opt.on') || app.querySelector('.sheet-opt');
    if (first) first.focus();
  }
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'open-sheet': state.sheetOpen = true; break;
    case 'close-sheet': state.sheetOpen = false; break;
    case 'set-view':
      state.view = el.dataset.view;
      state.sheetOpen = false;
      state.month = null;
      state.selected = null;
      break;
    case 'toggle-band': state.hidden[el.dataset.band] = !state.hidden[el.dataset.band]; break;
    case 'set-mode': state.scheduleMode = el.dataset.mode; break;
    case 'month-prev': shiftMonth(-1); break;
    case 'month-next': shiftMonth(1); break;
    case 'pick-day': state.selected = el.dataset.date; break;
    case 'goto-date': gotoDate(el.dataset.date); return; // the link changes the page, which redraws
    case 'toast': toast(el.dataset.msg); return;
    default: return;
  }
  savePrefs();
  render();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.sheetOpen) {
    state.sheetOpen = false;
    render();
    const btn = document.querySelector('.switcher');
    if (btn) btn.focus();
  }
});

window.addEventListener('hashchange', () => {
  state.sheetOpen = false;
  document.getElementById('toast').classList.remove('show');
  render();
});

render();

// Offline copy + optional updates (banner: Update / Later).
initUpdates();
