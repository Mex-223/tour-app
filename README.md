# Tour App

Schedules, rehearsals, shows and contacts for HFAR, Zascha and MM & TNE, in one app.

It's a web app you install from the browser ("Add to Home Screen"). It works on iPhone, Android and laptop, with no App Store needed.

**Live:** https://mex-223.github.io/tour-app/

## Status

**Step 1 (done):** app shell: Today, Schedule (month + list), Day page, People, band switcher.

**Step 2 (done):** real data with Firebase
- Login with Google or email + password
- Create bands (the creator is MGMT), invite people with a link
- Roles per band: MGMT plans and edits, members see everything except editing
- MGMT adds, edits and deletes events (shows, rehearsals, travel, days off, promo)
- My view = everything you're ticked for, across all bands, with clash warnings
- Works offline: changes sync when you're back online
- Optional updates: "New version ready · Update / Later"

**Next steps**
3. Team contacts + Docs + guest PDF export
4. Money + merch
5. Laptop layout

## Setup (one time, already done)

1. Firebase project `tour-app-ce80c`: Authentication (Google + Email/Password), Firestore (europe-west3).
2. Authentication → Settings → Authorized domains: `mex-223.github.io`
3. Firestore → Rules: paste the contents of [`firestore.rules`](firestore.rules) and publish.

## Test mode

Add `?mock=demo` to the address to try the app with example bands and fake logins. Nothing touches the real database. `?mock=1` keeps the test data between reloads.

## How it's built

Plain HTML, CSS and JavaScript, with no build step. `js/app.js` is the entry point; screens are in `js/views/`, live data in `js/store.js`, Firebase calls in `js/backend/firebase.js`. `sw.js` keeps an offline copy and handles optional updates.

To run it locally: `python3 -m http.server`, then open http://localhost:8000/?mock=demo
