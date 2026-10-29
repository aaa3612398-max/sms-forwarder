import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { normalizeEvent, type ToolkitEvent } from './events.js';
import type { SmsPayload, WireEnvelope } from './types.js';
import { PROTOCOL_VERSION } from './types.js';

const HKDF_INFO = 'sms-forwarder-v1';
const NONCE_LEN = 12;
const KEY_LEN = 32;

function deriveKey(secret: Buffer): Buffer {
  const salt = Buffer.alloc(0);
  return Buffer.from(hkdfSync('sha256', secret, salt, HKDF_INFO, KEY_LEN));
}

export function generatePairingSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function secretToBuffer(secretB64Url: string): Buffer {
  return Buffer.from(secretB64Url, 'base64url');
}

export function encryptEvent(secretB64Url: string, event: ToolkitEvent): WireEnvelope {
  const key = deriveKey(secretToBuffer(secretB64Url));
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const plaintext = Buffer.from(JSON.stringify(event), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, tag]);
  return {
    v: PROTOCOL_VERSION,
    n: nonce.toString('base64url'),
    c: ciphertext.toString('base64url'),
  };
}

export function decryptEvent(secretB64Url: string, envelope: WireEnvelope): ToolkitEvent {
  if (envelope.v !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${envelope.v}`);
  }
  const key = deriveKey(secretToBuffer(secretB64Url));
  const nonce = Buffer.from(envelope.n, 'base64url');
  const combined = Buffer.from(envelope.c, 'base64url');
  if (combined.length < 16) {
    throw new Error('Invalid ciphertext');
  }
  const tag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return normalizeEvent(JSON.parse(decrypted.toString('utf8')));
}

export function encryptPayload(secretB64Url: string, payload: SmsPayload): WireEnvelope {
  return encryptEvent(secretB64Url, { type: 'sms', ...payload });
}

export function decryptPayload(secretB64Url: string, envelope: WireEnvelope): SmsPayload {
  const event = decryptEvent(secretB64Url, envelope);
  if (event.type !== 'sms') throw new Error('Expected SMS event');
  const { type: _t, ...rest } = event;
  return rest;
}

/** Constant-time compare for optional request signing extension */
export function hmacToken(secretB64Url: string, message: string): string {
  const key = deriveKey(secretToBuffer(secretB64Url));
  return createHmac('sha256', key).update(message, 'utf8').digest('base64url');
}
