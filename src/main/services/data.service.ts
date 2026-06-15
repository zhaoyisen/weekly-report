import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog } from 'electron';
import { getDatabase, getDatabaseFilePath, replaceDatabaseFromFile } from '@main/db/client';
import type { DataOperationResult } from '@shared/types';

export class DataService {
  async backupDatabase(): Promise<DataOperationResult> {
    const result = await dialog.showSaveDialog({
      title: '备份数据',
      defaultPath: `weekly-report-backup-${formatStamp()}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const database = await getDatabase();
    await fs.mkdir(path.dirname(result.filePath), { recursive: true });
    await fs.writeFile(result.filePath, database.exportBuffer());
    return {
      success: true,
      filePath: result.filePath,
      message: '数据备份完成'
    };
  }

  async restoreDatabase(): Promise<DataOperationResult> {
    const result = await dialog.showOpenDialog({
      title: '恢复数据',
      properties: ['openFile'],
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true };
    }

    await replaceDatabaseFromFile(result.filePaths[0]);
    return {
      success: true,
      filePath: result.filePaths[0],
      message: '数据恢复完成'
    };
  }

  getDatabasePath(): { path: string } {
    return { path: getDatabaseFilePath() };
  }
}

function formatStamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join('');
}
