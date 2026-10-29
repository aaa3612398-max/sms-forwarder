#!/usr/bin/env node
/**
 * Ensures Android-compatible encryption: fixed secret + deterministic nonce patch via env.
 * Run after `npm run build:protocol`.
 */
import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { decryptPayload } from '../protocol/dist/crypto.js';

const secretB64 = Buffer.alloc(32, 0xab).toString('base64url');
const secret = Buffer.from(secretB64, 'base64url');
const key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'sms-forwarder-v1', 32));
const nonce = Buffer.alloc(12, 0x01);
const payload = JSON.stringify({
  id: 'interop-1',
  sender: '10010',
  body: '验证码112233',
  timestamp: 1730000000000,
  simSlot: null,
});

const cipher = createCipheriv('aes-256-gcm', key, nonce);
const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const envelope = {
  v: 1,
  n: nonce.toString('base64url'),
  c: Buffer.concat([encrypted, tag]).toString('base64url'),
};

const decoded = decryptPayload(secretB64, envelope);
if (decoded.body !== '验证码112233') {
  console.error('interop decrypt failed', decoded);
  process.exit(1);
}
console.log('crypto-interop OK');
