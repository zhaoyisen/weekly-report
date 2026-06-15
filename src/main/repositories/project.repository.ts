import { randomUUID } from 'node:crypto';
import { getDatabase } from '@main/db/client';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@shared/types';
import { AppError } from '@main/errors';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export class ProjectRepository {
  async list(): Promise<Project[]> {
    const db = await getDatabase();
    const rows = db.select<ProjectRow>(
      `SELECT id, name, description, color, created_at, updated_at
       FROM projects
       WHERE deleted_at IS NULL
       ORDER BY name ASC`
    );
    return rows.map(mapProject);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    if (!input.name.trim()) {
      throw new AppError('VALIDATION_ERROR', '项目名称不能为空');
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = randomUUID();
    db.run(
      `INSERT INTO projects (id, name, description, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name.trim(), input.description ?? null, input.color ?? null, now, now]
    );
    const project = await this.get(id);
    if (!project) {
      throw new AppError('DB_ERROR', '项目创建失败');
    }
    return project;
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const current = await this.get(id);
    if (!current) {
      throw new AppError('PROJECT_NOT_FOUND', '项目不存在');
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run(
      `UPDATE projects
       SET name = ?, description = ?, color = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        patch.name?.trim() || current.name,
        patch.description === undefined ? current.description : patch.description,
        patch.color === undefined ? current.color : patch.color,
        now,
        id
      ]
    );

    const updated = await this.get(id);
    if (!updated) {
      throw new AppError('DB_ERROR', '项目更新失败');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [now, now, id]);
  }

  async get(id: string): Promise<Project | null> {
    const db = await getDatabase();
    const row = db.get<ProjectRow>(
      `SELECT id, name, description, color, created_at, updated_at
       FROM projects
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row ? mapProject(row) : null;
  }
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
