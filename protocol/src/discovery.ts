import { hmacToken } from './crypto.js';

export const DISCOVERY_UDP_PORT = 8766;
export const DEFAULT_HTTP_PORT = 8765;

export interface DiscoverRequest {
  t: 'sf-discover-req';
  n: string;
}

export interface DiscoverResponse {
  t: 'sf-discover-res';
  n: string;
  h: string;
  p: number;
  d: string;
  s: string;
}

export type DiscoverRequestWire = DiscoverRequest & { s: string };

export function buildDiscoverRequest(secret: string, nonce: string): DiscoverRequestWire {
  return {
    t: 'sf-discover-req',
    n: nonce,
    s: hmacToken(secret, `disc-req:${nonce}`),
  };
}

export function verifyDiscoverRequest(secret: string, req: DiscoverRequestWire): boolean {
  if (req.t !== 'sf-discover-req' || !req.n || !req.s) return false;
  const expected = hmacToken(secret, `disc-req:${req.n}`);
  return timingSafeEqual(req.s, expected);
}

export function buildDiscoverResponse(
  secret: string,
  nonce: string,
  host: string,
  port: number,
  deviceId: string,
): DiscoverResponse {
  const payload = `${nonce}|${host}|${port}|${deviceId}`;
  return {
    t: 'sf-discover-res',
    n: nonce,
    h: host,
    p: port,
    d: deviceId,
    s: hmacToken(secret, `disc-res:${payload}`),
  };
}

export function verifyDiscoverResponse(
  secret: string,
  res: DiscoverResponse,
  expectedDeviceId?: string,
): boolean {
  if (res.t !== 'sf-discover-res' || !res.n || !res.h || !res.p || !res.d || !res.s) return false;
  if (expectedDeviceId && res.d !== expectedDeviceId) return false;
  const payload = `${res.n}|${res.h}|${res.p}|${res.d}`;
  const expected = hmacToken(secret, `disc-res:${payload}`);
  return timingSafeEqual(res.s, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
