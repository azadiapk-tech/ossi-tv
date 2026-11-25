# Ossi TV – browser version (one HTML file)

`OssiTV-Web.html` is the whole app in a single file. Download it, double-click it, sign in once.

- Same interface as the Android app (live TV, movies, series, EPG, favourites, re-ordering, …)
- Video in the browser: HLS via hls.js, live MPEG-TS via mpegts.js (loaded from jsDelivr, internet needed)
- The login is remembered by the browser (stored only on this computer)

Limits of browsers: some movie files use codecs a browser cannot play (e.g. AC3/E-AC3 audio, HEVC video) —
they play without sound or not at all; the Android app has no such limits. The server must allow
browser requests (CORS), otherwise the login shows a connection error.

Rebuild after changing the app: `python3 web/build.py` (needs Pillow).

## If login says the server blocks browsers (CORS)
Keep `Ossi TV starten.bat` in the same folder as `OssiTV-Web.html` and double-click it (Windows).
It opens the page in a separate Chrome/Edge window (own profile in `%LocalAppData%\OssiTV-Chrome`)
with web security disabled so the page may talk to the IPTV server.
Use that window only for Ossi TV, never for normal browsing.
