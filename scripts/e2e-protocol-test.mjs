#!/usr/bin/env node
/**
 * Simulates phone → desktop flow: encrypt SMS payload and POST to local receiver.
 */
import http from 'node:http';
import {
  decryptPayload,
  encryptPayload,
  generatePairingSecret,
} from '../protocol/dist/index.js';

const secret = generatePairingSecret();
const payload = {
  id: 'e2e-sim-1',
  sender: '10690000',
  body: '【测试】您的验证码是998877，请勿告知他人。',
  timestamp: Date.now(),
  simSlot: 1,
};

let pairingSecret = secret;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/v1/messages') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const decoded = decryptPayload(pairingSecret, envelope);
        if (decoded.body !== payload.body) throw new Error('body mismatch');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, decoded }));
        server.close();
        process.exit(0);
      } catch (e) {
        res.writeHead(401);
        res.end();
        console.error('E2E failed:', e);
        process.exit(1);
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  pairingSecret = secret;
  const envelope = encryptPayload(secret, payload);
  const body = JSON.stringify(envelope);
  fetch(`http://127.0.0.1:${port}/api/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).then((r) => {
    if (!r.ok) {
      console.error('POST failed', r.status);
      process.exit(1);
    }
  });
});

setTimeout(() => {
  console.error('E2E timeout');
  process.exit(1);
}, 5000);
