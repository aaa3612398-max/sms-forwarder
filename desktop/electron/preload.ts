import { contextBridge, ipcRenderer } from 'electron';
import type { PairedPhoneRecord, SmsPayload } from '@sms-forwarder/protocol';

contextBridge.exposeInMainWorld('smsForwarder', {
  getPairing: () =>
    ipcRenderer.invoke('pairing:get') as Promise<{
      host: string;
      port: number;
      pairingQr: string;
      deviceId: string;
      deviceName: string;
      pairedPhones: PairedPhoneRecord[];
    }>,
  listPairedDevices: () =>
    ipcRenderer.invoke('pairing:listDevices') as Promise<PairedPhoneRecord[]>,
  unpairDevice: (deviceId: string) =>
    ipcRenderer.invoke('pairing:unpair', deviceId) as Promise<PairedPhoneRecord[]>,
  regeneratePairing: () =>
    ipcRenderer.invoke('pairing:regenerate') as Promise<{
      pairingQr: string;
      host: string;
      port: number;
      pairedPhones: PairedPhoneRecord[];
    }>,
  getLaunchAtLogin: () => ipcRenderer.invoke('settings:getLaunchAtLogin') as Promise<boolean>,
  setLaunchAtLogin: (enabled: boolean) =>
    ipcRenderer.invoke('settings:setLaunchAtLogin', enabled) as Promise<boolean>,
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
  onDevicesChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('pairing:devices-changed', listener);
    return () => ipcRenderer.removeListener('pairing:devices-changed', listener);
  },
});
