import type { PairingPayload } from './types.js';

export function encodePairingQr(payload: PairingPayload): string {
  return JSON.stringify({
    t: 'sms-forwarder-pair',
    h: payload.host,
    p: payload.port,
    s: payload.secret,
    d: payload.deviceId,
    ...(payload.name ? { n: payload.name } : {}),
  });
}

export function decodePairingQr(raw: string): PairingPayload {
  const data = JSON.parse(raw) as {
    t?: string;
    h?: string;
    p?: number;
    s?: string;
    d?: string;
    n?: string;
  };
  if (data.t !== 'sms-forwarder-pair' || !data.h || !data.p || !data.s || !data.d) {
    throw new Error('Invalid pairing QR payload');
  }
  if (data.p < 1 || data.p > 65535) {
    throw new Error('Invalid port');
  }
  return {
    host: data.h,
    port: data.p,
    secret: data.s,
    deviceId: data.d,
    name: data.n,
  };
}
