import http from 'node:http';
import dgram from 'node:dgram';
import os from 'node:os';
import {
  buildDiscoverResponse,
  decryptPayload,
  encodePairingQr,
  DISCOVERY_UDP_PORT,
  verifyDiscoverRequest,
  type DiscoverRequestWire,
  type SmsPayload,
  type WireEnvelope,
} from '@sms-forwarder/protocol';
import type { DesktopPairingConfig } from './pairing-config.js';
import {
  loadDesktopConfig,
  saveDesktopConfig,
  touchPairedPhone,
} from './pairing-config.js';

export interface ServerState {
  port: number;
  secret: string;
  host: string;
  pairingQr: string;
  deviceId: string;
  deviceName: string;
}

export type MessageHandler = (payload: SmsPayload) => void;

export function pickLanHost(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function buildState(config: DesktopPairingConfig): ServerState {
  const host = pickLanHost();
  return {
    port: config.port,
    secret: config.secret,
    host,
    deviceId: config.deviceId,
    deviceName: config.deviceName,
    pairingQr: encodePairingQr({
      host,
      port: config.port,
      secret: config.secret,
      deviceId: config.deviceId,
      name: config.deviceName,
    }),
  };
}

export function createMessageServer(onMessage: MessageHandler): {
  server: http.Server;
  discoverySocket: dgram.Socket;
  getState: () => ServerState;
  getConfig: () => DesktopPairingConfig;
  setConfig: (config: DesktopPairingConfig) => void;
  refreshHost: () => void;
} {
  let config = loadDesktopConfig();
  let state = buildState(config);

  const refreshHost = () => {
    state = { ...state, host: pickLanHost(), pairingQr: buildState(config).pairingQr };
  };

  const setConfig = (next: DesktopPairingConfig) => {
    config = next;
    saveDesktopConfig(config);
    state = buildState(config);
  };

  const server = http.createServer((req, res) => {
    refreshHost();

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, v: 1, d: config.deviceId }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/messages') {
      const deviceId = req.headers['x-sf-device-id'];
      const deviceName = req.headers['x-sf-device-name'];
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')) as WireEnvelope;
          const payload = decryptPayload(config.secret, envelope);
          if (typeof deviceId === 'string' && deviceId.length > 0) {
            const known = config.pairedPhones.some((p) => p.deviceId === deviceId);
            if (config.pairedPhones.length > 0 && !known) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'device_unpaired' }));
              return;
            }
            config = touchPairedPhone(
              config,
              deviceId,
              typeof deviceName === 'string' ? deviceName : 'Android 手机',
            );
            saveDesktopConfig(config);
          }
          onMessage(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'decrypt_failed' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(config.port, '0.0.0.0', () => {
    state = buildState(config);
  });

  const discoverySocket = dgram.createSocket('udp4');
  discoverySocket.on('message', (msg, rinfo) => {
    try {
      const req = JSON.parse(msg.toString('utf8')) as DiscoverRequestWire;
      if (!verifyDiscoverRequest(config.secret, req)) return;
      refreshHost();
      const res = buildDiscoverResponse(
        config.secret,
        req.n,
        state.host,
        config.port,
        config.deviceId,
      );
      const out = Buffer.from(JSON.stringify(res), 'utf8');
      discoverySocket.send(out, rinfo.port, rinfo.address);
    } catch {
      /* ignore malformed */
    }
  });
  discoverySocket.bind(DISCOVERY_UDP_PORT, '0.0.0.0');

  const hostTimer = setInterval(refreshHost, 5000);
  hostTimer.unref?.();

  return {
    server,
    discoverySocket,
    getState: () => state,
    getConfig: () => config,
    setConfig,
    refreshHost,
  };
}
