import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { FileChunkEvent, FileEndEvent } from '@sms-forwarder/protocol';

interface TransferState {
  name: string;
  mime: string;
  total: number;
  received: Map<number, Buffer>;
}

const transfers = new Map<string, TransferState>();

function downloadsDir(): string {
  return app.getPath('downloads');
}

export function handleFileChunk(
  chunk: FileChunkEvent,
  onProgress: (p: { transferId: string; name: string; percent: number }) => void,
): void {
  let st = transfers.get(chunk.transferId);
  if (!st) {
    st = { name: chunk.name, mime: chunk.mime, total: chunk.total, received: new Map() };
    transfers.set(chunk.transferId, st);
  }
  st.received.set(chunk.index, Buffer.from(chunk.data, 'base64'));
  const percent = Math.round((st.received.size / st.total) * 100);
  onProgress({ transferId: chunk.transferId, name: chunk.name, percent });
}

export function handleFileEnd(
  end: FileEndEvent,
  onDone: (p: { path: string; name: string }) => void,
): void {
  const st = transfers.get(end.transferId);
  if (!st) return;
  const parts: Buffer[] = [];
  for (let i = 0; i < st.total; i++) {
    const part = st.received.get(i);
    if (!part) return;
    parts.push(part);
  }
  const outDir = downloadsDir();
  let filename = end.name.replace(/[^\w.\-()\u4e00-\u9fff ]+/g, '_');
  let outPath = path.join(outDir, filename);
  let n = 1;
  while (fs.existsSync(outPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    outPath = path.join(outDir, `${base} (${n})${ext}`);
    n++;
  }
  fs.writeFileSync(outPath, Buffer.concat(parts));
  transfers.delete(end.transferId);
  onDone({ path: outPath, name: end.name });
}
