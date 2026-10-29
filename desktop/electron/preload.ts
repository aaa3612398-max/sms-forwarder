import { contextBridge, ipcRenderer } from 'electron';
import type { SmsPayload } from '@sms-forwarder/protocol';

contextBridge.exposeInMainWorld('smsForwarder', {
  getPairing: () => ipcRenderer.invoke('pairing:get') as Promise<{
    host: string;
    port: number;
    pairingQr: string;
  }>,
  listSenders: () =>
    ipcRenderer.invoke('messages:listSenders') as Promise<
      { sender: string; lastTimestamp: number; count: number }[]
    >,
  listBySender: (sender: string) =>
    ipcRenderer.invoke('messages:listBySender', sender) as Promise<SmsPayload[]>,
  searchMessages: (q: string) =>
    ipcRenderer.invoke('messages:search', q) as Promise<SmsPayload[]>,
  copyText: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
  onNewMessage: (cb: (msg: SmsPayload) => void) => {
    const listener = (_: unknown, payload: SmsPayload) => cb(payload);
    ipcRenderer.on('message:new', listener);
    return () => ipcRenderer.removeListener('message:new', listener);
  },
});
