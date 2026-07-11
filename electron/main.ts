import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { IPC } from '../src/shared/ipc';
import type { AppConfig, CurationStatus } from '../src/shared/types';
import { loadConfig, saveConfig } from '../src/main/configStore';
import { openDb, defaultDbPath, setCurationStatus, resetRomsAndCuration } from '../src/main/db';
import { runPipeline, buildCuratedList } from '../src/main/pipeline';
import { exportRoms, type ExportableRom } from '../src/main/exporter';
import { checkDatFiles } from '../src/main/datFileCheck';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron's default sandboxed preload can only `require()` Node/Electron
      // built-ins, not sibling local files like ../src/shared/ipc — our preload
      // needs that require, so disable the sandbox for it. contextIsolation stays
      // on, so the renderer (untrusted web content) still can't touch Node/Electron
      // directly; only the preload script itself gets full require().
      sandbox: false,
    },
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[renderer] failed to load: ${code} ${description}`);
  });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[preload error] ${preloadPath}:`, error);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] process gone:', details);
  });

  // External links (No-Intro, Redump, Twitch dev console) should open in the
  // user's normal browser, not navigate this app window away from itself.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isOwnApp = url.startsWith('http://localhost:5173') || url.startsWith('file://');
    if (!isOwnApp) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  const db = openDb(defaultDbPath(app.getPath('userData')));

  ipcMain.handle(IPC.getAppVersion, async () => app.getVersion());

  ipcMain.handle(IPC.configGet, async () => loadConfig(app.getPath('userData')));

  ipcMain.handle(IPC.configSet, async (_event, config: AppConfig) => {
    await saveConfig(app.getPath('userData'), config);
  });

  ipcMain.handle(IPC.chooseFolder, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.pipelineRun, async (event) => {
    const config = await loadConfig(app.getPath('userData'));
    return runPipeline(db, config, (progress) => {
      event.sender.send(IPC.pipelineProgress, progress);
    });
  });

  ipcMain.handle(IPC.romList, async () => buildCuratedList(db));

  ipcMain.handle(
    IPC.romSetStatus,
    async (_event, romId: number, status: CurationStatus) => {
      setCurationStatus(db, romId, status);
    },
  );

  ipcMain.handle(IPC.exportRun, async (event) => {
    const config = await loadConfig(app.getPath('userData'));
    const curated = buildCuratedList(db);
    const kept: ExportableRom[] = curated
      .filter((r) => r.status === 'keep')
      .map((r) => ({
        id: r.id,
        path: r.path,
        consoleId: r.consoleId,
        matchedName: r.matchedName,
        filename: r.filename,
        region: r.region,
      }));
    const { manifest, copiedCount } = await exportRoms(config.destFolder, kept, (progress) => {
      event.sender.send(IPC.exportProgress, progress);
    });
    return { exportedCount: manifest.length, copiedCount };
  });

  ipcMain.handle(IPC.openExportFolder, async () => {
    const config = await loadConfig(app.getPath('userData'));
    if (config.destFolder) await shell.openPath(config.destFolder);
  });

  ipcMain.handle(IPC.checkDatFiles, async (_event, datFolder: string) => checkDatFiles(datFolder));

  ipcMain.handle(IPC.resetData, async () => {
    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      buttons: ['Cancel', 'Reset Everything'],
      defaultId: 0,
      cancelId: 0,
      title: 'Reset all data?',
      message: 'This clears every scanned ROM and all your keep/maybe/skip decisions.',
      detail:
        'Your ROM/DAT folder settings and cached IGDB ratings are kept, so a rescan afterward is still fast. This cannot be undone.',
    });
    if (result.response !== 1) return { reset: false };
    resetRomsAndCuration(db);
    return { reset: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
