export const PROTOCOL_VERSION = 1 as const;

export interface PairingPayload {
  host: string;
  port: number;
  secret: string;
  deviceId: string;
  name?: string;
}

export interface PairedPhoneRecord {
  deviceId: string;
  name: string;
  firstPairedAt: number;
  lastSeenAt: number;
}

export interface SmsPayload {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  simSlot: number | null;
}

export interface WireEnvelope {
  v: typeof PROTOCOL_VERSION;
  n: string;
  c: string;
}
