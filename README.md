# Tour App

Schedules, rehearsals, shows and contacts for HFAR, Zascha and MM & TNE, in one app.

It's a web app you install from the browser ("Add to Home Screen"). It works on iPhone, Android and laptop, with no App Store needed.

## Status

**Step 1 (done):** app shell with example data
- Today: My view, next call countdown, clash warnings
- Schedule: month calendar and list, band filter chips, clash markers
- Day page: timetable, who's on, venue, travel, hotel, catering, guest list, setlist
- People: team contacts, venue contacts, band members
- Band switcher: My view / All bands / each band

**Next steps**
2. Logins (email link), real data in Firebase, editing for MGMT, invites
3. Docs + guest PDF export with contacts
4. Money + merch
5. Laptop layout

## Try a different day

Add `?date=2026-11-27` to the address to see what the app looks like on a show day.

## How it's built

Plain HTML, CSS and JavaScript, with no build step and no dependencies. `index.html` loads `js/app.js`; each tab lives in `js/views/`. The example data is in `js/data.js`. `sw.js` makes it work offline.

To run it locally: `python3 -m http.server`, then open http://localhost:8000
