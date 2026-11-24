/* Ossi TV — the server is fixed; on first start the app shows a login screen (username + password only).
   The login is stored only on this device. */
window.OSSI_CONFIG = {
  name: 'Ossi',
  host: 'http://dlta4k.com:80',
  fixedHost: true,
  username: '',
  password: '',
  updateRepo: 'azadiapk-tech/ossi-tv'     /* public GitHub repo whose latest release holds OssiTV.apk */
};
