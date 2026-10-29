import { app, BrowserWindow, clipboard, ipcMain, Notification } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  extractVerificationCode,
  FILE_CHUNK_BYTES,
  MAX_FILE_BYTES,
  type ToolkitEvent,
} from '@sms-forwarder/protocol';
import { createMessageServer } from './server.js';
import { handleFileChunk, handleFileEnd } from './file-receive.js';
import { enqueueForPhone } from './outbox.js';
import {
  loadDesktopConfig,
  regenerateSecret,
  saveDesktopConfig,
  unpairPhone,
  type DesktopPairingConfig,
} from './pairing-config.js';
import { loadToolkitSettings, saveToolkitSettings } from './toolkit-settings.js';
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
let lastClipboard = '';
let clipboardTimer: ReturnType<typeof setInterval> | null = null;

function applyLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: false });
}

function notify(title: string, body: string): void {
  new Notification({ title, body: body.slice(0, 240) }).show();
}

function primaryPhoneId(): string | null {
  const phones = getConfig().pairedPhones;
  return phones[0]?.deviceId ?? null;
}

function pushToPhone(event: ToolkitEvent, targetDeviceId: string | null = null): boolean {
  const target = targetDeviceId ?? primaryPhoneId();
  if (!target) return false;
  enqueueForPhone(getConfig().secret, event, target);
  return true;
}

function handleToolkitEvent(event: ToolkitEvent): void {
  const settings = loadToolkitSettings();
  switch (event.type) {
    case 'sms':
      insertMessage(event);
      notifyNewMessage(event.sender, event.body);
      mainWindow?.webContents.send('message:new', event);
      break;
    case 'clipboard':
      clipboard.writeText(event.text);
      mainWindow?.webContents.send('toolkit:clipboard', event);
      notify('剪贴板已同步', event.text.slice(0, 80));
      break;
    case 'file_chunk':
      handleFileChunk(event, (p) => mainWindow?.webContents.send('toolkit:file-progress', p));
      break;
    case 'file_end':
      handleFileEnd(event, (p) => {
        mainWindow?.webContents.send('toolkit:file-done', p);
        notify('文件已保存', p.name);
      });
      break;
    case 'notification':
      if (settings.blockedNotificationPackages.includes(event.packageName)) break;
      mainWindow?.webContents.send('toolkit:notification', event);
      notify(`${event.appName} · ${event.title}`, event.text);
      break;
    case 'call':
      mainWindow?.webContents.send('toolkit:call', event);
      notify(
        event.callType === 'missed' ? '未接来电' : '来电',
        event.number || '未知号码',
      );
      break;
    case 'sms_send_result':
      mainWindow?.webContents.send('toolkit:sms-result', event);
      break;
    default:
      break;
  }
}

function notifyNewMessage(sender: string, body: string): void {
  const code = extractVerificationCode(body);
  const title = code ? `新短信 · 验证码 ${code}` : `新短信 · ${sender}`;
  notify(title, body);
}

function startClipboardWatch(): void {
  if (clipboardTimer) return;
  clipboardTimer = setInterval(() => {
    const settings = loadToolkitSettings();
    if (!settings.autoClipboardSync) return;
    const text = clipboard.readText();
    if (!text || text === lastClipboard) return;
    lastClipboard = text;
    if (pushToPhone({ type: 'clipboard', id: randomBytes(6).toString('hex'), text, timestamp: Date.now() })) {
      mainWindow?.webContents.send('toolkit:clipboard-sent', text);
    }
  }, 2000);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 760,
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
  const api = createMessageServer((event) => {
    handleToolkitEvent(event);
    mainWindow?.webContents.send('pairing:devices-changed');
  });
  getServerState = api.getState;
  getConfig = api.getConfig;
  setServerConfig = api.setConfig;
  applyLaunchAtLogin(getConfig().launchAtLogin);
  startClipboardWatch();
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
      } else setTimeout(check, 50);
    };
    check();
  }),
);

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

ipcMain.handle('toolkit:getSettings', () => loadToolkitSettings());
ipcMain.handle('toolkit:setSettings', (_e, partial: Partial<ReturnType<typeof loadToolkitSettings>>) => {
  const next = { ...loadToolkitSettings(), ...partial };
  saveToolkitSettings(next);
  return next;
});

ipcMain.handle('toolkit:sendClipboard', (_e, text: string) => {
  const ok = pushToPhone({
    type: 'clipboard',
    id: randomBytes(6).toString('hex'),
    text,
    timestamp: Date.now(),
  });
  if (ok) lastClipboard = text;
  return ok;
});

ipcMain.handle('toolkit:sendSms', (_e, payload: { to: string; body: string; simSlot: number | null }) => {
  return pushToPhone({
    type: 'sms_send',
    id: randomBytes(8).toString('hex'),
    to: payload.to,
    body: payload.body,
    simSlot: payload.simSlot,
  });
});

ipcMain.handle('toolkit:sendFile', async (_e, filePath: string) => {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_BYTES) throw new Error('文件超过 10MB 限制');
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const mime = 'application/octet-stream';
  const transferId = randomBytes(8).toString('hex');
  const total = Math.ceil(buf.length / FILE_CHUNK_BYTES) || 1;
  for (let i = 0; i < total; i++) {
    const slice = buf.subarray(i * FILE_CHUNK_BYTES, (i + 1) * FILE_CHUNK_BYTES);
    pushToPhone({
      type: 'file_chunk',
      transferId,
      name,
      mime,
      index: i,
      total,
      data: slice.toString('base64'),
    });
  }
  pushToPhone({ type: 'file_end', transferId, name, totalBytes: buf.length });
  return { transferId, name, total };
});

ipcMain.handle('messages:listSenders', () => listSenders());
ipcMain.handle('messages:listBySender', (_e, sender: string) => listBySender(sender));
ipcMain.handle('messages:search', (_e, q: string) => listMessages(q));
ipcMain.handle('clipboard:copy', (_e, text: string) => {
  clipboard.writeText(text);
});
