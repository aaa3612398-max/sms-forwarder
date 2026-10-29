import { decryptPayload, encryptPayload, generatePairingSecret, hmacToken } from '../src/crypto.js';
import { decodePairingQr, encodePairingQr } from '../src/pairing.js';
import { extractVerificationCode } from '../src/verification.js';
import type { SmsPayload } from '../src/types.js';

describe('crypto roundtrip', () => {
  it('encrypts and decrypts SMS payload', () => {
    const secret = generatePairingSecret();
    const payload: SmsPayload = {
      id: 'test-id-1',
      sender: '+8613800138000',
      body: '您的验证码是123456，5分钟内有效。',
      timestamp: 1730000000000,
      simSlot: 1,
    };
    const envelope = encryptPayload(secret, payload);
    expect(envelope.v).toBe(1);
    const decoded = decryptPayload(secret, envelope);
    expect(decoded).toEqual(payload);
  });

  it('rejects wrong secret', () => {
    const secret = generatePairingSecret();
    const envelope = encryptPayload(secret, {
      id: 'x',
      sender: '10086',
      body: 'hi',
      timestamp: 1,
      simSlot: null,
    });
    expect(() => decryptPayload(generatePairingSecret(), envelope)).toThrow();
  });
});

describe('pairing QR', () => {
  it('encodes and decodes', () => {
    const raw = encodePairingQr({
      host: '192.168.1.10',
      port: 8765,
      secret: generatePairingSecret(),
    });
    const decoded = decodePairingQr(raw);
    expect(decoded.host).toBe('192.168.1.10');
    expect(decoded.port).toBe(8765);
  });
});

describe('verification code', () => {
  it('extracts Chinese SMS codes', () => {
    expect(extractVerificationCode('【支付宝】验证码123456，请勿泄露。')).toBe('123456');
    expect(extractVerificationCode('Your code: 8888 for login')).toBe('8888');
  });
});

describe('hmac', () => {
  it('is deterministic', () => {
    const secret = generatePairingSecret();
    expect(hmacToken(secret, 'ping')).toBe(hmacToken(secret, 'ping'));
  });
});
