/// <reference types="vite/client" />

import type { PairedPhoneRecord, SmsPayload } from '@sms-forwarder/protocol';

declare global {
  interface Window {
    smsForwarder: {
      getPairing: () => Promise<{
        host: string;
        port: number;
        pairingQr: string;
        deviceId: string;
        deviceName: string;
        pairedPhones: PairedPhoneRecord[];
      }>;
      listPairedDevices: () => Promise<PairedPhoneRecord[]>;
      unpairDevice: (deviceId: string) => Promise<PairedPhoneRecord[]>;
      regeneratePairing: () => Promise<{
        pairingQr: string;
        host: string;
        port: number;
        pairedPhones: PairedPhoneRecord[];
      }>;
      getLaunchAtLogin: () => Promise<boolean>;
      setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
      getToolkitSettings: () => Promise<{ autoClipboardSync: boolean; blockedNotificationPackages: string[] }>;
      setToolkitSettings: (partial: Record<string, unknown>) => Promise<{ autoClipboardSync: boolean; blockedNotificationPackages: string[] }>;
      sendClipboardToPhone: (text: string) => Promise<boolean>;
      sendSmsFromDesktop: (payload: { to: string; body: string; simSlot: number | null }) => Promise<boolean>;
      sendFileToPhone: (filePath: string) => Promise<{ transferId: string; name: string; total: number }>;
      listSenders: () => Promise<{ sender: string; lastTimestamp: number; count: number }[]>;
      listBySender: (sender: string) => Promise<SmsPayload[]>;
      searchMessages: (q: string) => Promise<SmsPayload[]>;
      copyText: (text: string) => Promise<void>;
      onNewMessage: (cb: (msg: SmsPayload) => void) => () => void;
      onDevicesChanged: (cb: () => void) => () => void;
      onToolkit: (channel: string, cb: (payload: unknown) => void) => () => void;
    };
  }
}

export {};
