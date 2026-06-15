import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { app } from 'electron';
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';

const nodeRequire = createRequire(__filename);

let databasePromise: Promise<AppDatabase> | null = null;

export class AppDatabase {
  constructor(
    private readonly sqlite: Database,
    private readonly filePath: string
  ) {}

  exec(sql: string): void {
    this.sqlite.exec(sql);
    this.persist();
  }

  run(sql: string, params: SqlValue[] = []): void {
    const statement = this.sqlite.prepare(sql);
    try {
      statement.bind(params);
      statement.step();
    } finally {
      statement.free();
    }
    this.persist();
  }

  select<T>(sql: string, params: SqlValue[] = []): T[] {
    const statement = this.sqlite.prepare(sql);
    const rows: T[] = [];
    try {
      statement.bind(params);
      while (statement.step()) {
        rows.push(statement.getAsObject() as unknown as T);
      }
    } finally {
      statement.free();
    }
    return rows;
  }

  get<T>(sql: string, params: SqlValue[] = []): T | null {
    return this.select<T>(sql, params)[0] ?? null;
  }

  transaction<T>(fn: () => T): T {
    this.sqlite.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.sqlite.exec('COMMIT;');
      this.persist();
      return result;
    } catch (error) {
      this.sqlite.exec('ROLLBACK;');
      throw error;
    }
  }

  persist(): void {
    const data = this.sqlite.export();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }

  exportBuffer(): Buffer {
    return Buffer.from(this.sqlite.export());
  }

  close(): void {
    this.sqlite.close();
  }
}

export async function getDatabase(): Promise<AppDatabase> {
  if (!databasePromise) {
    databasePromise = createDatabase();
  }
  return databasePromise;
}

export function getDatabaseFilePath(): string {
  return getDatabasePath();
}

export async function replaceDatabaseFromFile(sourcePath: string): Promise<void> {
  validateImportPath(sourcePath);
  const SQL = await loadSqlJs();
  const importedData = fs.readFileSync(sourcePath);
  const imported = new SQL.Database(importedData);

  try {
    validateImportedDatabase(imported);
  } finally {
    imported.close();
  }

  if (databasePromise) {
    const current = await databasePromise;
    current.close();
    databasePromise = null;
  }

  const targetPath = getDatabasePath();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  databasePromise = createDatabase();
  await databasePromise;
}

async function createDatabase(): Promise<AppDatabase> {
  const SQL = await loadSqlJs();
  const dbPath = getDatabasePath();
  const data = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  const sqlite = data ? new SQL.Database(data) : new SQL.Database();
  const database = new AppDatabase(sqlite, dbPath);
  runMigrations(database);
  return database;
}

function loadSqlJs(): Promise<SqlJsStatic> {
  return initSqlJs({
    locateFile: (fileName) => nodeRequire.resolve(`sql.js/dist/${fileName}`)
  });
}

function getDatabasePath(): string {
  const appDataPath = app.getPath('userData');
  return path.join(appDataPath, 'app.db');
}

function validateImportPath(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('备份文件不存在');
  }

  const stats = fs.statSync(sourcePath);
  if (!stats.isFile()) {
    throw new Error('请选择有效的备份文件');
  }
}

function validateImportedDatabase(database: Database): void {
  const tables = database.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('task_records', 'projects', 'app_settings')"
  );
  const names = new Set<string>();
  const values = tables[0]?.values ?? [];
  for (const row of values) {
    if (typeof row[0] === 'string') {
      names.add(row[0]);
    }
  }

  if (!names.has('task_records')) {
    throw new Error('备份文件不是有效的周报任务数据库');
  }
}

function runMigrations(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_records (
      id TEXT PRIMARY KEY,
      raw_content TEXT NOT NULL,
      polished_content TEXT,
      status TEXT NOT NULL,
      record_date TEXT NOT NULL,
      project_id TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      priority TEXT,
      ai_model TEXT,
      ai_status TEXT NOT NULL DEFAULT 'pending',
      ai_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      encrypted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_request_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      request_type TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES task_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_records_record_date ON task_records(record_date);
    CREATE INDEX IF NOT EXISTS idx_task_records_status ON task_records(status);
    CREATE INDEX IF NOT EXISTS idx_task_records_project_id ON task_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_task_records_deleted_at ON task_records(deleted_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_active ON projects(name) WHERE deleted_at IS NULL;
  `);
}
