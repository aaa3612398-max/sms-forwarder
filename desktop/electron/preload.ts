import { contextBridge, ipcRenderer } from 'electron';
import type { PairedPhoneRecord, SmsPayload } from '@sms-forwarder/protocol';

contextBridge.exposeInMainWorld('smsForwarder', {
  getPairing: () => ipcRenderer.invoke('pairing:get'),
  listPairedDevices: () => ipcRenderer.invoke('pairing:listDevices') as Promise<PairedPhoneRecord[]>,
  unpairDevice: (deviceId: string) => ipcRenderer.invoke('pairing:unpair', deviceId),
  regeneratePairing: () => ipcRenderer.invoke('pairing:regenerate'),
  getLaunchAtLogin: () => ipcRenderer.invoke('settings:getLaunchAtLogin') as Promise<boolean>,
  setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke('settings:setLaunchAtLogin', enabled),
  getToolkitSettings: () => ipcRenderer.invoke('toolkit:getSettings'),
  setToolkitSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke('toolkit:setSettings', partial),
  sendClipboardToPhone: (text: string) => ipcRenderer.invoke('toolkit:sendClipboard', text) as Promise<boolean>,
  sendSmsFromDesktop: (payload: { to: string; body: string; simSlot: number | null }) =>
    ipcRenderer.invoke('toolkit:sendSms', payload) as Promise<boolean>,
  sendFileToPhone: (filePath: string) => ipcRenderer.invoke('toolkit:sendFile', filePath),
  listSenders: () => ipcRenderer.invoke('messages:listSenders'),
  listBySender: (sender: string) => ipcRenderer.invoke('messages:listBySender', sender) as Promise<SmsPayload[]>,
  searchMessages: (q: string) => ipcRenderer.invoke('messages:search', q) as Promise<SmsPayload[]>,
  copyText: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
  onNewMessage: (cb: (msg: SmsPayload) => void) => {
    const listener = (_: unknown, payload: SmsPayload) => cb(payload);
    ipcRenderer.on('message:new', listener);
    return () => ipcRenderer.removeListener('message:new', listener);
  },
  onDevicesChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('pairing:devices-changed', listener);
    return () => ipcRenderer.removeListener('pairing:devices-changed', listener);
  },
  onToolkit: (channel: string, cb: (payload: unknown) => void) => {
    const ch = `toolkit:${channel}`;
    const listener = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ch, listener);
    return () => ipcRenderer.removeListener(ch, listener);
  },
});
