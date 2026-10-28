// Records trailer.html to a video with Electron (no ffmpeg needed):
//   npx electron scripts/trailer/record.js [out.mp4]
// Or renders stills to check the frames:
//   npx electron scripts/trailer/record.js --stills=1,5,10.4 [out-dir]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--') && !a.endsWith('record.js') && a !== '.');
const stills = process.argv.find((a) => a.startsWith('--stills='))?.slice('--stills='.length);
const root = path.resolve(__dirname, '../..');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 960,
    height: 540,
    useContentSize: true,
    backgroundColor: '#000',
    webPreferences: { backgroundThrottling: false, webSecurity: false },
  });
  win.webContents.on('console-message', (e) => console.log(`[page] ${e.message}`));
  await win.loadFile(path.join(__dirname, 'trailer.html'));
  await win.webContents.executeJavaScript('window.ready');

  if (stills) {
    const dir = args[0] || path.join(root, 'docs/store/play/trailer-stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of stills.split(',').map(Number)) {
      const url = await win.webContents.executeJavaScript(`(preview(${t}), document.getElementById('c').toDataURL('image/png'))`);
      const file = path.join(dir, `t${t.toFixed(2)}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file);
    }
    app.quit();
    return;
  }

  const mime = await win.webContents.executeJavaScript(
    `['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus'].find((m) => MediaRecorder.isTypeSupported(m))`,
  );
  let out = args[0] || path.join(root, 'docs/store/play/trailer.mp4');
  if (mime.startsWith('video/webm')) out = out.replace(/\.mp4$/, '.webm');
  console.log(`Recording 30 s as ${mime}…`);
  const bell = fs.readFileSync(path.join(root, 'apps/app/assets/bell.wav'));
  const bytes = await win.webContents.executeJavaScript(
    `start(new Uint8Array([${[...bell].join(',')}]), ${JSON.stringify(mime)})`,
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(Object.values(bytes)));
  console.log(out);
  app.quit();
});
