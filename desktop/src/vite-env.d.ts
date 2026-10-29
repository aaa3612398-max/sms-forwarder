/// <reference types="vite/client" />

import type { SmsPayload } from '@sms-forwarder/protocol';

declare global {
  interface Window {
    smsForwarder: {
      getPairing: () => Promise<{ host: string; port: number; pairingQr: string }>;
      listSenders: () => Promise<{ sender: string; lastTimestamp: number; count: number }[]>;
      listBySender: (sender: string) => Promise<SmsPayload[]>;
      searchMessages: (q: string) => Promise<SmsPayload[]>;
      copyText: (text: string) => Promise<void>;
      onNewMessage: (cb: (msg: SmsPayload) => void) => () => void;
    };
  }
}

export {};
