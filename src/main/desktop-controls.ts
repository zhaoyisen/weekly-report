import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray } from 'electron';

let tray: Tray | null = null;
let isQuitting = false;

export function registerDesktopControls(mainWindow: BrowserWindow): void {
  app.on('before-quit', () => {
    isQuitting = true;
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    mainWindow.hide();
  });

  tray = new Tray(createTrayIcon());
  tray.setToolTip('智能周报');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开记录窗口',
        click: () => showAndFocusQuickInput(mainWindow)
      },
      {
        label: '快速记录',
        accelerator: 'Ctrl+Alt+W',
        click: () => showAndFocusQuickInput(mainWindow)
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('double-click', () => showAndFocusQuickInput(mainWindow));

  globalShortcut.register('CommandOrControl+Alt+W', () => {
    showAndFocusQuickInput(mainWindow);
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    tray?.destroy();
    tray = null;
  });
}

function showAndFocusQuickInput(mainWindow: BrowserWindow): void {
  if (mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  mainWindow.webContents.send('app:focus-quick-input');
}

function createTrayIcon(): Electron.NativeImage {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#202723"/>
      <path d="M9 8h14v3H9V8Zm0 6h14v3H9v-3Zm0 6h9v3H9v-3Z" fill="#d9b44a"/>
      <path d="M22 20l2 2 4-5" fill="none" stroke="#f4f0e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  return image.resize({ width: 16, height: 16 });
}
