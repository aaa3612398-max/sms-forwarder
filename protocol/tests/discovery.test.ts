import { randomBytes } from 'node:crypto';
import {
  buildDiscoverRequest,
  buildDiscoverResponse,
  verifyDiscoverRequest,
  verifyDiscoverResponse,
} from '../src/discovery.js';
import { generatePairingSecret } from '../src/crypto.js';
import { encodePairingQr, decodePairingQr } from '../src/pairing.js';

describe('discovery', () => {
  const secret = generatePairingSecret();
  const nonce = randomBytes(8).toString('base64url');

  it('request/response roundtrip', () => {
    const req = buildDiscoverRequest(secret, nonce);
    expect(verifyDiscoverRequest(secret, req)).toBe(true);
    expect(verifyDiscoverRequest(generatePairingSecret(), req)).toBe(false);

    const res = buildDiscoverResponse(secret, nonce, '192.168.1.5', 8765, 'desktop-1');
    expect(verifyDiscoverResponse(secret, res, 'desktop-1')).toBe(true);
    expect(verifyDiscoverResponse(secret, res, 'other')).toBe(false);
  });
});

describe('pairing QR v2', () => {
  it('includes device id', () => {
    const raw = encodePairingQr({
      host: '10.0.0.2',
      port: 8765,
      secret: generatePairingSecret(),
      deviceId: 'pc-abc',
      name: '工作电脑',
    });
    const decoded = decodePairingQr(raw);
    expect(decoded.deviceId).toBe('pc-abc');
    expect(decoded.name).toBe('工作电脑');
  });
});
