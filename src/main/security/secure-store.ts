import { safeStorage } from 'electron';

const ENCRYPTED_PREFIX = 'enc:';
const PLAIN_PREFIX = 'plain:';

export function encryptSecret(value: string): { value: string; encrypted: boolean } {
  if (!value) {
    return { value: '', encrypted: false };
  }

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value).toString('base64');
    return { value: `${ENCRYPTED_PREFIX}${encrypted}`, encrypted: true };
  }

  return { value: `${PLAIN_PREFIX}${Buffer.from(value, 'utf8').toString('base64')}`, encrypted: false };
}

export function decryptSecret(value: string | null): string {
  if (!value) {
    return '';
  }

  if (value.startsWith(ENCRYPTED_PREFIX)) {
    const encrypted = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
    return safeStorage.decryptString(encrypted);
  }

  if (value.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(value.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
  }

  return value;
}

export function maskSecret(value: string): string {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return '****';
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
