#!/usr/bin/env node
/**
 * Simulates phone ↔ desktop toolkit flow: SMS event POST + outbox clipboard delivery.
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  decryptEvent,
  encryptEvent,
  generatePairingSecret,
} from '../protocol/dist/index.js';

const secret = generatePairingSecret();
const phoneDeviceId = 'phone-e2e-1';

const smsEvent = {
  type: 'sms',
  id: 'e2e-sim-1',
  sender: '10690000',
  body: '【测试】您的验证码是998877，请勿告知他人。',
  timestamp: Date.now(),
  simSlot: 1,
};

const outbox = [];

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url === '/api/v1/events' || req.url === '/api/v1/messages')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const decoded = decryptEvent(secret, envelope);
        if (decoded.type === 'sms' && decoded.body !== smsEvent.body) throw new Error('body mismatch');
        // simulate desktop queuing clipboard to phone
        outbox.push({
          id: randomBytes(4).toString('hex'),
          envelope: encryptEvent(secret, {
            type: 'clipboard',
            id: 'clip-1',
            text: 'desktop-to-phone',
            timestamp: Date.now(),
          }),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(401);
        res.end();
        console.error('POST failed', e);
        process.exit(1);
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/v1/outbox') {
    const deviceId = req.headers['x-sf-device-id'];
    if (deviceId !== phoneDeviceId) {
      res.writeHead(403);
      res.end();
      return;
    }
    const items = outbox.splice(0, outbox.length);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, items }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const envelope = encryptEvent(secret, smsEvent);
  const post = await fetch(`http://127.0.0.1:${port}/api/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SF-Device-Id': phoneDeviceId },
    body: JSON.stringify(envelope),
  });
  if (!post.ok) {
    console.error('SMS POST failed');
    process.exit(1);
  }
  const poll = await fetch(`http://127.0.0.1:${port}/api/v1/outbox`, {
    headers: { 'X-SF-Device-Id': phoneDeviceId },
  });
  const data = await poll.json();
  const item = data.items?.[0];
  if (!item) {
    console.error('outbox empty');
    process.exit(1);
  }
  const clip = decryptEvent(secret, item.envelope);
  if (clip.type !== 'clipboard' || clip.text !== 'desktop-to-phone') {
    console.error('clipboard mismatch', clip);
    process.exit(1);
  }
  console.log('e2e toolkit OK');
  server.close();
  process.exit(0);
});

setTimeout(() => {
  console.error('E2E timeout');
  process.exit(1);
}, 5000);
