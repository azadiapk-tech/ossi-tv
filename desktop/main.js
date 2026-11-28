/* Ossi TV for Windows: the same app as on Android, in its own window.
   The app talks to the IPTV server as an app (like the Android version),
   not as a web browser. */
const { app, BrowserWindow, session, shell, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const UA = 'OssiTV/' + app.getVersion() + ' (Windows; Electron)';
/* sports info sites (results, channels, translation) get the engine's normal browser identity;
   some of them send an empty page to unknown apps */
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + process.versions.chrome + ' Safari/537.36';
const WEB_HOSTS = /(^|\.)(beinsports\.com\.tr|sporx\.com|365scores\.com|espn\.com|google\.com|googleapis\.com)$/i;
app.userAgentFallback = UA;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'UserAgentClientHint');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;

function create() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 960, minHeight: 540,
    backgroundColor: '#03041a',
    title: 'Ossi TV',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,          /* the page is our own local file; lets it read the IPTV server's answers */
      backgroundThrottling: false
    }
  });

  /* Only the IPTV traffic leaves the app: strip the browser-only headers. */
  const ses = session.defaultSession;
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    const h = d.requestHeaders;
    if (/^https?:/i.test(d.url)) {
      for (const k of Object.keys(h)) {
        if (/^(origin|referer|sec-ch-ua.*|sec-fetch-.*)$/i.test(k)) delete h[k];
      }
      let host = ''; try { host = new URL(d.url).hostname; } catch (e) {}
      h['User-Agent'] = WEB_HOSTS.test(host) ? WEB_UA : UA;
    }
    cb({ requestHeaders: h });
  });

  /* Never navigate away from the app; real links open in the normal browser. */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });

  /* F11 = full screen, Alt+Enter too. */
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11' || (i.alt && i.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.on('page-title-updated', (e) => e.preventDefault());

  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.on('closed', () => { win = null; });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

/* ---------- updates: same idea as on Android (GitHub release "windows") ---------- */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
let manualCheck = false, downloading = false;
function toPage(kind, n, txt) {
  if (!win) return;
  win.webContents.executeJavaScript('window.__ossiUpd && window.__ossiUpd(' + JSON.stringify(kind) + ',' + (+n || 0) + ',' + JSON.stringify(txt || '') + ')').catch(() => {});
}
function errText(e) { return String((e && e.message) || e || '').split('\n')[0].slice(0, 80); }
autoUpdater.on('update-available', (i) => toPage('avail', 0, i && i.version));
autoUpdater.on('update-not-available', () => { if (manualCheck) toPage('none'); });
autoUpdater.on('download-progress', (p) => toPage('prog', Math.round(p.percent || 0)));
autoUpdater.on('update-downloaded', () => { toPage('inst'); setTimeout(() => autoUpdater.quitAndInstall(true, true), 800); });
autoUpdater.on('error', (e) => { if (manualCheck || downloading) toPage('err', 0, errText(e)); downloading = false; });
ipcMain.on('ossi:version', (e) => { e.returnValue = app.getVersion(); });
ipcMain.on('ossi:check', (e, manual) => {
  manualCheck = !!manual;
  if (!app.isPackaged) { if (manualCheck) toPage('none'); return; }
  autoUpdater.checkForUpdates().catch((err) => { if (manualCheck) toPage('err', 0, errText(err)); });
});
ipcMain.on('ossi:download', () => { downloading = true; autoUpdater.downloadUpdate().catch(() => {}); });
ipcMain.on('ossi:open', (e, url) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
