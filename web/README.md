# Ossi TV – browser version (one HTML file)

`OssiTV-Web.html` is the whole app in a single file. Download it, double-click it, sign in once.

- Same interface as the Android app (live TV, movies, series, EPG, favourites, re-ordering, …)
- Video in the browser: HLS via hls.js, live MPEG-TS via mpegts.js (loaded from jsDelivr, internet needed)
- The login is remembered by the browser (stored only on this computer)

Limits of browsers: some movie files use codecs a browser cannot play (e.g. AC3/E-AC3 audio, HEVC video) —
they play without sound or not at all; the Android app has no such limits. The server must allow
browser requests (CORS), otherwise the login shows a connection error.

Rebuild after changing the app: `python3 web/build.py` (needs Pillow).
