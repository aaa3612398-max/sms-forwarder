import { app, BrowserWindow, clipboard, ipcMain, Notification } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractVerificationCode } from '@sms-forwarder/protocol';
import { createMessageServer } from './server.js';
import { insertMessage, listBySender, listMessages, listSenders } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let getServerState = () => ({
  port: 0,
  secret: '',
  host: '127.0.0.1',
  pairingQr: '',
});

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
  const { getState } = createMessageServer((payload) => {
    insertMessage(payload);
    notifyNewMessage(payload.sender, payload.body);
    mainWindow?.webContents.send('message:new', payload);
  });
  getServerState = getState;

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pairing:get', () =>
  new Promise<{ host: string; port: number; pairingQr: string }>((resolve) => {
    const check = () => {
      const s = getServerState();
      if (s.port > 0 && s.pairingQr) {
        resolve({ host: s.host, port: s.port, pairingQr: s.pairingQr });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  }),
);

ipcMain.handle('messages:listSenders', () => listSenders());
ipcMain.handle('messages:listBySender', (_e, sender: string) => listBySender(sender));
ipcMain.handle('messages:search', (_e, q: string) => listMessages(q));
ipcMain.handle('clipboard:copy', (_e, text: string) => {
  clipboard.writeText(text);
});
