# Notes for working on this repo

- Owner (Mex) is not a developer: explain changes in plain words, no jargon.
- No build step, no npm: plain ES modules loaded by the browser. Firebase SDK comes from `https://www.gstatic.com/firebasejs/10.12.2/` (pinned).
- Hosted on GitHub Pages from `main` (root). Every push to `main` is live.
- **Releasing:** bump `VERSION` (and `NOTES`) in `sw.js`, otherwise phones won't see the update. Add any new file to `SHELL` in `sw.js`.
- Updates are optional for users (banner: Update / Later). Don't add auto-reload.
- Firestore can't store nested arrays: timetable is `[{time, label}]`.
- Writes are fire-and-forget (`w(() => ...)` in `js/backend/firebase.js`) so the app never hangs offline.
  Always pass a *function* to `w()` and build refs/batches inside it from the current `db`: on iOS the
  Firestore client can get terminated in the background; `withRetry`/`listen` reconnect and repeat.
- Security rules live in `firestore.rules`; the owner pastes them into the Firebase console by hand. If data shape or permissions change, update the rules and tell him to re-paste.
- Test without Firebase: `?mock=demo` (seeded) or `?mock=1` (in-memory test backend in `js/backend/mock.js`, mirrors the rules roughly).
