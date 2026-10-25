// Navigation: open an address in the user's favourite maps app.
// A web app can't see which apps are installed, so the user picks once
// (Apple Maps / Google Maps / Waze) and can tick "remember on this device".
// These links open the installed app if it's there, otherwise the maps website.

const KEY = 'tourapp.navApp';

export const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

export const NAV_APPS = [
  { id: 'apple', name: 'Apple Maps', onlyApple: true },
  { id: 'google', name: 'Google Maps' },
  { id: 'waze', name: 'Waze' }
];

export const availableNavApps = () => NAV_APPS.filter((a) => !a.onlyApple || isApple());

export function getNavApp() {
  try {
    const v = localStorage.getItem(KEY);
    return availableNavApps().some((a) => a.id === v) ? v : null;
  } catch (e) { return null; }
}

export function setNavApp(id) {
  try {
    if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY);
  } catch (e) { /* ignore */ }
}

// Directions to the place (not just showing it on the map)
export function navUrl(app, query) {
  const q = encodeURIComponent(query);
  if (app === 'apple') return `https://maps.apple.com/?daddr=${q}`;
  if (app === 'waze') return `https://waze.com/ul?q=${q}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function openNav(app, query) {
  const url = navUrl(app, query);
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;
}

// An address worth navigating to (not a "[placeholder]")
export const navigable = (address) => !!address && !/[[\]]/.test(address);
