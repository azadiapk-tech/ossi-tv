# Ossi TV for Windows

Same app code as Android (`app/src/main/assets/www`), packed with Electron.

- `page.py` builds `app/index.html` from the shared code + `player.js` (HTML5 video, hls.js, mpegts.js)
- `main.js` window, app user agent, updates (electron-updater, release tag `windows`)
- `preload.js` the small `OssiDesk` bridge (version, update, open link)

Built by `.github/workflows/windows.yml` on every push that touches the app code.
Download: https://github.com/azadiapk-tech/ossi-tv/releases/download/windows/OssiTV-Setup.exe
