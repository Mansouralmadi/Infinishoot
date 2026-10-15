// Desktop wrapper: opens the built game (dist/index.html) in its own window.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#000000',
    title: 'InfiniShoot',
    autoHideMenuBar: true,
    webPreferences: {
      // Keep the game running when the window is in the background, so an online host never pauses everyone.
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // "Save to file" asks where to put the save, starting in Documents.
  // INFINISHOOT_SAVE_DIR skips the dialog (used for automated checks).
  win.webContents.session.on('will-download', (_event, item) => {
    const dir = process.env.INFINISHOOT_SAVE_DIR;
    if (dir) item.setSavePath(path.join(dir, item.getFilename()));
    else item.setSaveDialogOptions({ title: 'Save InfiniShoot progress', defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });

  // F11 toggles fullscreen.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  // Links open in the normal browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());
}

Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
