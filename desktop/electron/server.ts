import http from 'node:http';
import os from 'node:os';
import {
  decryptPayload,
  encodePairingQr,
  generatePairingSecret,
  type SmsPayload,
  type WireEnvelope,
} from '@sms-forwarder/protocol';

export interface ServerState {
  port: number;
  secret: string;
  host: string;
  pairingQr: string;
}

export type MessageHandler = (payload: SmsPayload) => void;

function pickLanHost(): string {
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

export function createMessageServer(onMessage: MessageHandler): {
  server: http.Server;
  getState: () => ServerState;
} {
  const secret = generatePairingSecret();
  const host = pickLanHost();
  let state: ServerState = {
    port: 0,
    secret,
    host,
    pairingQr: '',
  };

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, v: 1 }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/messages') {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')) as WireEnvelope;
          const payload = decryptPayload(state.secret, envelope);
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

  server.listen(0, '0.0.0.0', () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 8765;
    state = {
      ...state,
      port,
      pairingQr: encodePairingQr({ host: state.host, port, secret: state.secret }),
    };
  });

  return {
    server,
    getState: () => state,
  };
}
