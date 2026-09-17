import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import https from 'https';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 700,
    frame: false, // Windows 11 custom titlebar
    backgroundColor: '#0e141b',
    title: 'Steam Squad Sync',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (isDev && !process.env.TEST_DIST) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      // Fallback if dev server takes a second
      setTimeout(() => mainWindow?.loadURL(devServerUrl), 1000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept new window creations to open in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('steam:request', async (_event, targetUrl: string) => {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SteamSquadSync/1.0 (Windows 11 Desktop App)',
          'Accept': 'application/json',
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 429) {
            resolve({
              success: false,
              status: 429,
              error: 'Rate limit exceeded (HTTP 429)',
            });
            return;
          }

          if (res.statusCode && res.statusCode >= 400) {
            resolve({
              success: false,
              status: res.statusCode,
              error: `HTTP ${res.statusCode}`,
            });
            return;
          }

          try {
            const parsed = JSON.parse(rawData);
            resolve({ success: true, status: res.statusCode, data: parsed });
          } catch (jsonErr) {
            resolve({
              success: false,
              status: res.statusCode,
              error: 'Invalid JSON response from Steam',
            });
          }
        });
      });

      req.on('error', (e) => {
        resolve({
          success: false,
          error: e.message || 'Network error communicating with Steam',
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Connection to Steam API timed out',
        });
      });

      req.end();
    } catch (err: any) {
      resolve({
        success: false,
        error: err?.message || 'Failed to construct Steam API request',
      });
    }
  });
});

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('steam://'))) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
