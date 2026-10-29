#!/usr/bin/env node
import dgram from 'node:dgram';
import { randomBytes } from 'node:crypto';
import {
  buildDiscoverRequest,
  buildDiscoverResponse,
  verifyDiscoverResponse,
  generatePairingSecret,
} from '../protocol/dist/index.js';

const secret = generatePairingSecret();
const nonce = randomBytes(9).toString('base64url');
const deviceId = 'desktop-e2e';
const host = '192.168.50.10';
const port = 8765;

const socket = dgram.createSocket('udp4');
socket.on('message', (msg, rinfo) => {
  const req = JSON.parse(msg.toString('utf8'));
  if (req.t !== 'sf-discover-req') return;
  const res = buildDiscoverResponse(secret, req.n, host, port, deviceId);
  socket.send(Buffer.from(JSON.stringify(res), 'utf8'), rinfo.port, rinfo.address);
});

await new Promise((resolve, reject) => {
  socket.bind(8766, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
});

const req = buildDiscoverRequest(secret, nonce);
const client = dgram.createSocket('udp4');
const payload = Buffer.from(JSON.stringify(req), 'utf8');

await new Promise((resolve, reject) => {
  client.on('message', (msg) => {
    const res = JSON.parse(msg.toString('utf8'));
    if (!verifyDiscoverResponse(secret, res, deviceId)) {
      reject(new Error('bad response sig'));
      return;
    }
    if (res.h !== host || res.p !== port) {
      reject(new Error('bad host/port'));
      return;
    }
    resolve();
  });
  client.send(payload, 8766, '127.0.0.1', (err) => {
    if (err) reject(err);
  });
  setTimeout(() => reject(new Error('timeout')), 3000);
});

client.close();
socket.close();
console.log('discovery-e2e OK');
