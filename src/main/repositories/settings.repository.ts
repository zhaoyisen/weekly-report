import type { SqlValue } from 'sql.js';
import { getDatabase } from '@main/db/client';

interface SettingRow {
  key: string;
  value: string | null;
  encrypted: number;
  updated_at: string;
}

export class SettingsRepository {
  async get(key: string): Promise<SettingRow | null> {
    const db = await getDatabase();
    return db.get<SettingRow>(
      'SELECT key, value, encrypted, updated_at FROM app_settings WHERE key = ?',
      [key]
    );
  }

  async getMany(keys: string[]): Promise<Map<string, SettingRow>> {
    const rows = await Promise.all(keys.map((key) => this.get(key)));
    const map = new Map<string, SettingRow>();
    for (const row of rows) {
      if (row) {
        map.set(row.key, row);
      }
    }
    return map;
  }

  async set(key: string, value: SqlValue, encrypted = false): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO app_settings (key, value, encrypted, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, encrypted = excluded.encrypted, updated_at = excluded.updated_at`,
      [key, value, encrypted ? 1 : 0, now]
    );
  }
}
