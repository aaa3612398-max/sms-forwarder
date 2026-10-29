import { randomBytes } from 'node:crypto';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { encryptEvent, type ToolkitEvent, type WireEnvelope } from '@sms-forwarder/protocol';

export interface OutboxItem {
  id: string;
  targetDeviceId: string | null;
  envelope: WireEnvelope;
  createdAt: number;
}

interface OutboxFile {
  items: OutboxItem[];
}

function outboxPath(): string {
  return path.join(app.getPath('userData'), 'outbox.v1.json');
}

function load(): OutboxFile {
  if (!fs.existsSync(outboxPath())) return { items: [] };
  try {
    return JSON.parse(fs.readFileSync(outboxPath(), 'utf8')) as OutboxFile;
  } catch {
    return { items: [] };
  }
}

function save(data: OutboxFile): void {
  fs.writeFileSync(outboxPath(), JSON.stringify(data), 'utf8');
}

export function enqueueForPhone(
  secret: string,
  event: ToolkitEvent,
  targetDeviceId: string | null = null,
): string {
  const data = load();
  const id = randomBytes(8).toString('hex');
  data.items.push({
    id,
    targetDeviceId,
    envelope: encryptEvent(secret, event),
    createdAt: Date.now(),
  });
  save(data);
  return id;
}

export function pullForDevice(deviceId: string, limit = 20): OutboxItem[] {
  const data = load();
  const picked: OutboxItem[] = [];
  const rest: OutboxItem[] = [];
  for (const item of data.items) {
    if (
      picked.length < limit &&
      (item.targetDeviceId === null || item.targetDeviceId === deviceId)
    ) {
      picked.push(item);
    } else {
      rest.push(item);
    }
  }
  if (picked.length > 0) {
    save({ items: rest });
  }
  return picked;
}

export function ackIds(ids: string[]): void {
  const set = new Set(ids);
  const data = load();
  save({ items: data.items.filter((i) => !set.has(i.id)) });
}
