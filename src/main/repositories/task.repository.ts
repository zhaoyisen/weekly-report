import { randomUUID } from 'node:crypto';
import type { SqlValue } from 'sql.js';
import { getDatabase } from '@main/db/client';
import { AppError } from '@main/errors';
import type {
  AiStatus,
  CreateTaskInput,
  TaskListQuery,
  TaskListResult,
  TaskRecord,
  UpdateTaskInput
} from '@shared/types';

interface TaskRow {
  id: string;
  raw_content: string;
  polished_content: string | null;
  status: string;
  record_date: string;
  project_id: string | null;
  project_name: string | null;
  tags_json: string;
  priority: string | null;
  ai_model: string | null;
  ai_status: string;
  ai_error: string | null;
  created_at: string;
  updated_at: string;
}

export class TaskRepository {
  async create(input: CreateTaskInput): Promise<TaskRecord> {
    if (!input.rawContent.trim()) {
      throw new AppError('VALIDATION_ERROR', '原始记录不能为空');
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = randomUUID();
    db.run(
      `INSERT INTO task_records (
        id, raw_content, polished_content, status, record_date, project_id, tags_json,
        priority, ai_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.rawContent.trim(),
        input.polishedContent ?? null,
        input.status,
        input.recordDate,
        input.projectId ?? null,
        JSON.stringify(input.tags ?? []),
        input.priority ?? null,
        input.polishedContent ? 'succeeded' : 'pending',
        now,
        now
      ]
    );

    const task = await this.get(id);
    if (!task) {
      throw new AppError('DB_ERROR', '任务创建失败');
    }
    return task;
  }

  async update(id: string, patch: UpdateTaskInput): Promise<TaskRecord> {
    const current = await this.get(id);
    if (!current) {
      throw new AppError('TASK_NOT_FOUND', '任务不存在');
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run(
      `UPDATE task_records
       SET raw_content = ?,
           polished_content = ?,
           status = ?,
           record_date = ?,
           project_id = ?,
           tags_json = ?,
           priority = ?,
           updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        patch.rawContent?.trim() ?? current.rawContent,
        patch.polishedContent === undefined ? current.polishedContent : patch.polishedContent,
        patch.status ?? current.status,
        patch.recordDate ?? current.recordDate,
        patch.projectId === undefined ? current.projectId : patch.projectId,
        JSON.stringify(patch.tags ?? current.tags),
        patch.priority === undefined ? current.priority : patch.priority,
        now,
        id
      ]
    );

    const task = await this.get(id);
    if (!task) {
      throw new AppError('DB_ERROR', '任务更新失败');
    }
    return task;
  }

  async updateAiState(
    id: string,
    aiStatus: AiStatus,
    options: { polishedContent?: string | null; aiModel?: string | null; aiError?: string | null } = {}
  ): Promise<TaskRecord> {
    const db = await getDatabase();
    const current = await this.get(id);
    if (!current) {
      throw new AppError('TASK_NOT_FOUND', '任务不存在');
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE task_records
       SET polished_content = ?,
           ai_model = ?,
           ai_status = ?,
           ai_error = ?,
           updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        options.polishedContent === undefined ? current.polishedContent : options.polishedContent,
        options.aiModel === undefined ? current.aiModel : options.aiModel,
        aiStatus,
        options.aiError ?? null,
        now,
        id
      ]
    );

    const task = await this.get(id);
    if (!task) {
      throw new AppError('DB_ERROR', 'AI 状态更新失败');
    }
    return task;
  }

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE task_records SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [now, now, id]);
  }

  async get(id: string): Promise<TaskRecord | null> {
    const db = await getDatabase();
    const row = db.get<TaskRow>(
      `SELECT t.id, t.raw_content, t.polished_content, t.status, t.record_date, t.project_id,
              p.name AS project_name, t.tags_json, t.priority, t.ai_model, t.ai_status, t.ai_error,
              t.created_at, t.updated_at
       FROM task_records t
       LEFT JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [id]
    );
    return row ? mapTask(row) : null;
  }

  async list(query: TaskListQuery): Promise<TaskListResult> {
    const db = await getDatabase();
    const { whereSql, params } = buildWhere(query);
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const offset = Math.max(query.offset ?? 0, 0);

    const totalRow = db.get<{ total: number }>(
      `SELECT COUNT(1) AS total
       FROM task_records t
       LEFT JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
       ${whereSql}`,
      params
    );

    const rows = db.select<TaskRow>(
      `SELECT t.id, t.raw_content, t.polished_content, t.status, t.record_date, t.project_id,
              p.name AS project_name, t.tags_json, t.priority, t.ai_model, t.ai_status, t.ai_error,
              t.created_at, t.updated_at
       FROM task_records t
       LEFT JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
       ${whereSql}
       ORDER BY t.record_date DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      items: rows.map(mapTask),
      total: Number(totalRow?.total ?? 0)
    };
  }
}

function buildWhere(query: TaskListQuery): { whereSql: string; params: SqlValue[] } {
  const parts = ['t.deleted_at IS NULL'];
  const params: SqlValue[] = [];

  if (query.startDate) {
    parts.push('t.record_date >= ?');
    params.push(query.startDate);
  }

  if (query.endDate) {
    parts.push('t.record_date <= ?');
    params.push(query.endDate);
  }

  if (query.statuses?.length) {
    parts.push(`t.status IN (${query.statuses.map(() => '?').join(', ')})`);
    params.push(...query.statuses);
  }

  if (query.projectId) {
    parts.push('t.project_id = ?');
    params.push(query.projectId);
  }

  if (query.keyword?.trim()) {
    const keyword = `%${query.keyword.trim()}%`;
    parts.push('(t.raw_content LIKE ? OR t.polished_content LIKE ? OR p.name LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  if (query.tags?.length) {
    for (const tag of query.tags) {
      parts.push('t.tags_json LIKE ?');
      params.push(`%"${tag}"%`);
    }
  }

  return {
    whereSql: `WHERE ${parts.join(' AND ')}`,
    params
  };
}

function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    rawContent: row.raw_content,
    polishedContent: row.polished_content,
    status: row.status as TaskRecord['status'],
    recordDate: row.record_date,
    projectId: row.project_id,
    projectName: row.project_name,
    tags: safeParseTags(row.tags_json),
    priority: row.priority as TaskRecord['priority'],
    aiModel: row.ai_model,
    aiStatus: row.ai_status as TaskRecord['aiStatus'],
    aiError: row.ai_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function safeParseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
