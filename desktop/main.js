/* Ossi TV for Windows: the same app as on Android, in its own window.
   The app talks to the IPTV server as an app (like the Android version),
   not as a web browser. */
const { app, BrowserWindow, session, shell, Menu } = require('electron');
const path = require('path');

const UA = 'OssiTV/' + app.getVersion() + ' (Windows; Electron)';
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
      h['User-Agent'] = UA;
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

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
