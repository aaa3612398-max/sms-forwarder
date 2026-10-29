import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface ToolkitSettings {
  autoClipboardSync: boolean;
  blockedNotificationPackages: string[];
}

const FILE = 'toolkit-settings.v1.json';

const defaults: ToolkitSettings = {
  autoClipboardSync: false,
  blockedNotificationPackages: [],
};

function filePath(): string {
  return path.join(app.getPath('userData'), FILE);
}

export function loadToolkitSettings(): ToolkitSettings {
  if (!fs.existsSync(filePath())) return { ...defaults };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(filePath(), 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

export function saveToolkitSettings(settings: ToolkitSettings): void {
  fs.writeFileSync(filePath(), JSON.stringify(settings, null, 2), 'utf8');
}
