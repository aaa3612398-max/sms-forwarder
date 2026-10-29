import http from 'node:http';
import dgram from 'node:dgram';
import os from 'node:os';
import {
  buildDiscoverResponse,
  decryptEvent,
  encodePairingQr,
  DISCOVERY_UDP_PORT,
  verifyDiscoverRequest,
  type DiscoverRequestWire,
  type SmsPayload,
  type ToolkitEvent,
  type WireEnvelope,
} from '@sms-forwarder/protocol';
import type { DesktopPairingConfig } from './pairing-config.js';
import {
  loadDesktopConfig,
  saveDesktopConfig,
  touchPairedPhone,
} from './pairing-config.js';
import { ackIds, pullForDevice } from './outbox.js';

export interface ServerState {
  port: number;
  secret: string;
  host: string;
  pairingQr: string;
  deviceId: string;
  deviceName: string;
}

export type EventHandler = (
  event: ToolkitEvent,
  meta: { deviceId?: string; deviceName?: string },
) => void;

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

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function checkDeviceAccess(
  config: DesktopPairingConfig,
  deviceId: string | undefined,
): boolean {
  if (!deviceId) return true;
  if (config.pairedPhones.length === 0) return true;
  return config.pairedPhones.some((p) => p.deviceId === deviceId);
}

export function createMessageServer(onEvent: EventHandler): {
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

  const handlePostEvent = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    legacySmsOnly: boolean,
  ) => {
    const deviceId = req.headers['x-sf-device-id'];
    const deviceName = req.headers['x-sf-device-name'];
    const idStr = typeof deviceId === 'string' ? deviceId : undefined;
    if (!checkDeviceAccess(config, idStr)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'device_unpaired' }));
      return;
    }
    try {
      const body = await readBody(req);
      const envelope = JSON.parse(body.toString('utf8')) as WireEnvelope;
      const event = decryptEvent(config.secret, envelope);
      if (legacySmsOnly && event.type !== 'sms') {
        res.writeHead(400);
        res.end();
        return;
      }
      if (idStr) {
        config = touchPairedPhone(
          config,
          idStr,
          typeof deviceName === 'string' ? deviceName : 'Android 手机',
        );
        saveDesktopConfig(config);
      }
      onEvent(event, {
        deviceId: idStr,
        deviceName: typeof deviceName === 'string' ? deviceName : undefined,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'decrypt_failed' }));
    }
  };

  const server = http.createServer((req, res) => {
    refreshHost();

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, v: 1, d: config.deviceId }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/v1/outbox') {
      const deviceId = req.headers['x-sf-device-id'];
      const idStr = typeof deviceId === 'string' ? deviceId : '';
      if (!idStr || !checkDeviceAccess(config, idStr)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const items = pullForDevice(idStr);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, items }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/outbox/ack') {
      void readBody(req).then((body) => {
        try {
          const { ids } = JSON.parse(body.toString('utf8')) as { ids?: string[] };
          if (Array.isArray(ids)) ackIds(ids);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400);
          res.end();
        }
      });
      return;
    }

    if (
      req.method === 'POST' &&
      (req.url === '/api/v1/events' || req.url === '/api/v1/messages')
    ) {
      void handlePostEvent(req, res, req.url === '/api/v1/messages');
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
      /* ignore */
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

/** @deprecated use EventHandler */
export type MessageHandler = (payload: SmsPayload) => void;
