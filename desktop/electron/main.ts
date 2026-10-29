import { app, BrowserWindow, clipboard, ipcMain, Notification } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractVerificationCode } from '@sms-forwarder/protocol';
import { createMessageServer } from './server.js';
import {
  loadDesktopConfig,
  regenerateSecret,
  saveDesktopConfig,
  unpairPhone,
  type DesktopPairingConfig,
} from './pairing-config.js';
import { insertMessage, listBySender, listMessages, listSenders } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let getServerState = () => ({
  port: 0,
  secret: '',
  host: '127.0.0.1',
  pairingQr: '',
  deviceId: '',
  deviceName: '',
});
let getConfig = (): DesktopPairingConfig => loadDesktopConfig();
let setServerConfig = (_c: DesktopPairingConfig) => {};

function applyLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
  });
}

function notifyNewMessage(sender: string, body: string): void {
  const code = extractVerificationCode(body);
  const title = code ? `新短信 · 验证码 ${code}` : `新短信 · ${sender}`;
  const n = new Notification({ title, body: body.slice(0, 200) });
  n.show();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    title: '短信转发助手',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  const api = createMessageServer((payload) => {
    insertMessage(payload);
    notifyNewMessage(payload.sender, payload.body);
    mainWindow?.webContents.send('message:new', payload);
    mainWindow?.webContents.send('pairing:devices-changed');
  });
  getServerState = api.getState;
  getConfig = api.getConfig;
  setServerConfig = api.setConfig;

  const cfg = getConfig();
  applyLaunchAtLogin(cfg.launchAtLogin);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pairing:get', () =>
  new Promise((resolve) => {
    const check = () => {
      apiRefresh();
      const s = getServerState();
      const c = getConfig();
      if (s.port > 0 && s.pairingQr) {
        resolve({
          host: s.host,
          port: s.port,
          pairingQr: s.pairingQr,
          deviceId: s.deviceId,
          deviceName: s.deviceName,
          pairedPhones: c.pairedPhones,
        });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  }),
);

function apiRefresh(): void {
  /* getState refreshes host on access via server interval; force read */
  getServerState();
}

ipcMain.handle('pairing:listDevices', () => getConfig().pairedPhones);

ipcMain.handle('pairing:unpair', (_e, deviceId: string) => {
  const next = unpairPhone(getConfig(), deviceId);
  setServerConfig(next);
  return next.pairedPhones;
});

ipcMain.handle('pairing:regenerate', () => {
  const next = regenerateSecret(getConfig());
  setServerConfig(next);
  return {
    pairingQr: getServerState().pairingQr,
    host: getServerState().host,
    port: getServerState().port,
    pairedPhones: next.pairedPhones,
  };
});

ipcMain.handle('settings:getLaunchAtLogin', () => getConfig().launchAtLogin);

ipcMain.handle('settings:setLaunchAtLogin', (_e, enabled: boolean) => {
  const next = { ...getConfig(), launchAtLogin: Boolean(enabled) };
  saveDesktopConfig(next);
  setServerConfig(next);
  applyLaunchAtLogin(next.launchAtLogin);
  return next.launchAtLogin;
});

ipcMain.handle('messages:listSenders', () => listSenders());
ipcMain.handle('messages:listBySender', (_e, sender: string) => listBySender(sender));
ipcMain.handle('messages:search', (_e, q: string) => listMessages(q));
ipcMain.handle('clipboard:copy', (_e, text: string) => {
  clipboard.writeText(text);
});
