import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import type { SmsPayload } from '@sms-forwarder/protocol';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const file = path.join(app.getPath('userData'), 'messages.db');
    db = new Database(file);
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        body TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sim_slot INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
    `);
  }
  return db;
}

export function insertMessage(payload: SmsPayload): void {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO messages (id, sender, body, timestamp, sim_slot)
    VALUES (@id, @sender, @body, @timestamp, @simSlot)
  `);
  stmt.run(payload);
}

export interface StoredMessage extends SmsPayload {}

export function listMessages(search?: string): StoredMessage[] {
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return getDb()
      .prepare(
        `SELECT id, sender, body, timestamp, sim_slot as simSlot FROM messages
         WHERE sender LIKE ? OR body LIKE ? ORDER BY timestamp DESC LIMIT 500`,
      )
      .all(q, q) as StoredMessage[];
  }
  return getDb()
    .prepare(
      `SELECT id, sender, body, timestamp, sim_slot as simSlot FROM messages
       ORDER BY timestamp DESC LIMIT 500`,
    )
    .all() as StoredMessage[];
}

export function listBySender(sender: string): StoredMessage[] {
  return getDb()
    .prepare(
      `SELECT id, sender, body, timestamp, sim_slot as simSlot FROM messages
       WHERE sender = ? ORDER BY timestamp ASC`,
    )
    .all(sender) as StoredMessage[];
}

export function listSenders(): { sender: string; lastTimestamp: number; count: number }[] {
  return getDb()
    .prepare(
      `SELECT sender, MAX(timestamp) as lastTimestamp, COUNT(*) as count
       FROM messages GROUP BY sender ORDER BY lastTimestamp DESC`,
    )
    .all() as { sender: string; lastTimestamp: number; count: number }[];
}
