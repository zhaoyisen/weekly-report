import { randomUUID } from 'node:crypto';
import { getDatabase } from '@main/db/client';
import { AppError } from '@main/errors';
import { TaskRepository } from '@main/repositories/task.repository';
import { ProjectRepository } from '@main/repositories/project.repository';
import type {
  BatchPolishResult,
  CreateTaskInput,
  TaskListQuery,
  TaskListResult,
  TaskRecord,
  UpdateTaskInput
} from '@shared/types';
import { getPeriodRange } from '@shared/date';
import { AiService } from './ai.service';
import { SettingsService } from './settings.service';

const taskRepository = new TaskRepository();
const projectRepository = new ProjectRepository();
const aiService = new AiService();
const settingsService = new SettingsService();

export class TaskService {
  async create(input: CreateTaskInput): Promise<TaskRecord> {
    return taskRepository.create(input);
  }

  async update(id: string, patch: UpdateTaskInput): Promise<TaskRecord> {
    return taskRepository.update(id, patch);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await taskRepository.remove(id);
    return { success: true };
  }

  async get(id: string): Promise<TaskRecord> {
    const task = await taskRepository.get(id);
    if (!task) {
      throw new AppError('TASK_NOT_FOUND', '任务不存在');
    }
    return task;
  }

  async list(query: TaskListQuery): Promise<TaskListResult> {
    const settings = await settingsService.getAll();
    const periodQuery = { ...query };
    if (query.periodType && query.periodType !== 'all') {
      const range = getPeriodRange(query.periodType, query.baseDate ?? new Date().toISOString(), settings.app.weekStartDay);
      periodQuery.startDate = range.startDate;
      periodQuery.endDate = range.endDate;
    }
    return taskRepository.list(periodQuery);
  }

  async polish(id: string): Promise<TaskRecord> {
    const task = await this.get(id);
    await taskRepository.updateAiState(id, 'generating', { aiError: null });

    try {
      const project = task.projectId ? await projectRepository.get(task.projectId) : null;
      const result = await aiService.polishTask({
        rawContent: task.rawContent,
        status: task.status,
        recordDate: task.recordDate,
        projectName: project?.name ?? task.projectName ?? null
      });
      await logAiRequest(id, result.model, 'succeeded', null, result.durationMs);
      return taskRepository.updateAiState(id, 'succeeded', {
        polishedContent: result.content,
        aiModel: result.model,
        aiError: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 优化失败';
      await logAiRequest(id, task.aiModel ?? 'unknown', 'failed', message, null);
      await taskRepository.updateAiState(id, 'failed', { aiError: message });
      throw error;
    }
  }

  async batchPolish(ids: string[]): Promise<BatchPolishResult> {
    let successCount = 0;
    let failedCount = 0;
    for (const id of ids) {
      try {
        await this.polish(id);
        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }
    return { successCount, failedCount };
  }
}

async function logAiRequest(
  taskId: string,
  model: string,
  status: string,
  errorMessage: string | null,
  durationMs: number | null
): Promise<void> {
  const db = await getDatabase();
  db.run(
    `INSERT INTO ai_request_logs (id, task_id, provider, model, request_type, status, error_message, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), taskId, 'openai-compatible', model, 'polish_task', status, errorMessage, durationMs, new Date().toISOString()]
  );
}
