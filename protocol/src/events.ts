import type { SmsPayload } from './types.js';

export type SmsEvent = SmsPayload & { type: 'sms' };

export interface ClipboardEvent {
  type: 'clipboard';
  id: string;
  text: string;
  timestamp: number;
}

export interface FileChunkEvent {
  type: 'file_chunk';
  transferId: string;
  name: string;
  mime: string;
  index: number;
  total: number;
  data: string;
}

export interface FileEndEvent {
  type: 'file_end';
  transferId: string;
  name: string;
  totalBytes: number;
}

export interface NotificationEvent {
  type: 'notification';
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface CallEvent {
  type: 'call';
  id: string;
  callType: 'incoming' | 'missed';
  number: string;
  timestamp: number;
}

export interface SmsSendEvent {
  type: 'sms_send';
  id: string;
  to: string;
  body: string;
  simSlot: number | null;
}

export interface SmsSendResultEvent {
  type: 'sms_send_result';
  id: string;
  ok: boolean;
  error?: string;
}

export type ToolkitEvent =
  | SmsEvent
  | ClipboardEvent
  | FileChunkEvent
  | FileEndEvent
  | NotificationEvent
  | CallEvent
  | SmsSendEvent
  | SmsSendResultEvent;

export function smsToEvent(payload: SmsPayload): SmsEvent {
  return { type: 'sms', ...payload };
}

export function normalizeEvent(raw: unknown): ToolkitEvent {
  const o = raw as Record<string, unknown>;
  if (o && typeof o.type === 'string') {
    return raw as ToolkitEvent;
  }
  return { type: 'sms', ...(raw as SmsPayload) };
}

export const FILE_CHUNK_BYTES = 256 * 1024;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
