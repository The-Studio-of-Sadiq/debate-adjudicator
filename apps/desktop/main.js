// Windows shell: hosts the shared Expo web UI and gives it Node services over
// IPC: LAN sockets now (net.js), whisper.cpp transcription later.
const { app, BrowserWindow, net, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const lanNet = require('./net');

const DEV = process.argv.includes('--dev');

// `--profile=name` runs a second instance with its own storage and device id,
// e.g. to test host + client on one PC.
const profile = process.argv.find((a) => a.startsWith('--profile='))?.slice('--profile='.length);
if (profile) app.setPath('userData', path.join(app.getPath('userData'), `profile-${profile}`));
const DEV_URL = process.env.EXPO_WEB_URL || 'http://localhost:8081';
const WEB_ROOT = path.resolve(__dirname, '../app/dist');

// A secure custom scheme so the web build gets a secure context (microphone
// access) and its absolute asset paths resolve like on a web server.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function resolveAsset(urlPath) {
  const file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(urlPath)));
  if (!file.startsWith(WEB_ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  // Single-page app: unknown routes fall back to index.html.
  return path.join(WEB_ROOT, 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 380,
    backgroundColor: '#0f1115',
    title: profile ? `Debate Adjudicator (${profile})` : 'Debate Adjudicator',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      // Bells must ring on time even when the window is minimised or behind
      // another one; Chromium otherwise slows hidden timers to 1 Hz or less.
      backgroundThrottling: false,
    },
  });
  // A reload starts a fresh UI; drop sockets that belonged to the old one.
  win.webContents.on('did-start-loading', () => lanNet.closeAll());
  win.loadURL(DEV ? DEV_URL : 'app://bundle/');
}

app.whenReady().then(() => {
  lanNet.register();
  protocol.handle('app', (req) => {
    const file = resolveAsset(new URL(req.url).pathname);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // Only the microphone is needed; deny every other permission.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  if (!DEV && !fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
    console.error(`No web build at ${WEB_ROOT}. Run: npm run export:web -w app`);
  }
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => app.quit());
