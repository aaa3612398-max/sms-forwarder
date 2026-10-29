import { app, safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_HTTP_PORT,
  generatePairingSecret,
  type PairedPhoneRecord,
} from '@sms-forwarder/protocol';

export interface DesktopPairingConfig {
  deviceId: string;
  deviceName: string;
  secret: string;
  port: number;
  pairedPhones: PairedPhoneRecord[];
  launchAtLogin: boolean;
}

const CONFIG_FILE = 'pairing-config.v1.json';
const SECRET_FILE = 'pairing-secret.bin';

function configPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function secretPath(): string {
  return path.join(app.getPath('userData'), SECRET_FILE);
}

function newDeviceId(): string {
  return randomBytes(16).toString('hex');
}

function readSecret(): string | null {
  const p = secretPath();
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf);
    } catch {
      return null;
    }
  }
  return buf.toString('utf8');
}

function writeSecret(secret: string): void {
  const p = secretPath();
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(p, safeStorage.encryptString(secret));
  } else {
    fs.writeFileSync(p, secret, 'utf8');
  }
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    /* windows */
  }
}

export function loadDesktopConfig(): DesktopPairingConfig {
  let base: DesktopPairingConfig | null = null;

  if (fs.existsSync(configPath())) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath(), 'utf8')) as Partial<DesktopPairingConfig>;
      base = {
        deviceId: parsed.deviceId ?? newDeviceId(),
        deviceName: parsed.deviceName ?? '我的电脑',
        secret: generatePairingSecret(),
        port: parsed.port ?? DEFAULT_HTTP_PORT,
        pairedPhones: parsed.pairedPhones ?? [],
        launchAtLogin: parsed.launchAtLogin ?? false,
      };
    } catch {
      base = null;
    }
  }

  if (!base) {
    base = {
      deviceId: newDeviceId(),
      deviceName: '我的电脑',
      secret: generatePairingSecret(),
      port: DEFAULT_HTTP_PORT,
      pairedPhones: [],
      launchAtLogin: false,
    };
  }

  const secretFromStore = readSecret();
  if (secretFromStore) {
    base.secret = secretFromStore;
  } else {
    writeSecret(base.secret);
  }

  saveDesktopConfig(base);
  return base;
}

export function saveDesktopConfig(config: DesktopPairingConfig): void {
  writeSecret(config.secret);
  const { secret: _s, ...publicPart } = config;
  fs.writeFileSync(configPath(), JSON.stringify(publicPart, null, 2), 'utf8');
  try {
    fs.chmodSync(configPath(), 0o600);
  } catch {
    /* windows */
  }
}

export function touchPairedPhone(
  config: DesktopPairingConfig,
  deviceId: string,
  name: string,
): DesktopPairingConfig {
  const now = Date.now();
  const idx = config.pairedPhones.findIndex((p) => p.deviceId === deviceId);
  if (idx >= 0) {
    const updated = [...config.pairedPhones];
    updated[idx] = {
      ...updated[idx],
      name: name || updated[idx].name,
      lastSeenAt: now,
    };
    return { ...config, pairedPhones: updated };
  }
  return {
    ...config,
    pairedPhones: [
      ...config.pairedPhones,
      { deviceId, name: name || 'Android 手机', firstPairedAt: now, lastSeenAt: now },
    ],
  };
}

export function unpairPhone(config: DesktopPairingConfig, deviceId: string): DesktopPairingConfig {
  return {
    ...config,
    pairedPhones: config.pairedPhones.filter((p) => p.deviceId !== deviceId),
  };
}

export function regenerateSecret(config: DesktopPairingConfig): DesktopPairingConfig {
  return {
    ...config,
    secret: generatePairingSecret(),
    pairedPhones: [],
  };
}
