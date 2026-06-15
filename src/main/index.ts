import { app, BrowserWindow } from 'electron';
import { getDatabase } from './db/client';
import { registerIpcHandlers } from './ipc';
import { createMainWindow } from './window';
import { registerDesktopControls } from './desktop-controls';

app.setName('智能周报');

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await getDatabase();
    registerIpcHandlers();
    const mainWindow = createMainWindow();
    registerDesktopControls(mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const activatedWindow = createMainWindow();
        registerDesktopControls(activatedWindow);
      }
    });
  });

  app.on('window-all-closed', () => {
    // Windows utility behavior: keep the app available from the system tray.
  });
}
