# Ossi TV

IPTV player (Xtream Codes) for **Android phones, Android TV and Fire TV** (Fire OS), with an Arabic / English / German interface.

- Fixed server, login with **username + password** on first start (stored only on the device)
- Live TV with EPG (now / next), catch-up archive, favourites, re-ordering (touch drag & drop or remote ☰)
- Movies & series with details, trailer, resume, next-episode countdown, audio / subtitle tracks
- Picture-in-picture, volume / brightness gestures, sleep timer, in-app updates from the latest GitHub release

## Download
Latest APK: **Releases → OssiTV.apk**

## Build
Every push to `main` builds `OssiTV.apk` with GitHub Actions and publishes it as the latest release.

## Structure
- `app/src/main/assets/www` – the app UI (HTML/JS/CSS)
- `js/android.js` – bridge from the UI to the native player
- `NativePlayers.java` – ExoPlayer (HLS + MPEG-TS) behind the transparent WebView
- `MainActivity.java` – WebView host, remote keys, PiP, updates
