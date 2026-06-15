import { app, clipboard, ipcMain } from 'electron';
import type {
  CreateProjectInput,
  CreateTaskInput,
  ExportMarkdownInput,
  TaskListQuery,
  UpdateProjectInput,
  UpdateSettingsInput,
  UpdateTaskInput,
  WeeklyReportQuery
} from '@shared/types';
import { serializeError } from './errors';
import { TaskService } from './services/task.service';
import { SettingsService } from './services/settings.service';
import { AiService } from './services/ai.service';
import { ReportService } from './services/report.service';
import { DataService } from './services/data.service';
import { ProjectRepository } from './repositories/project.repository';

const taskService = new TaskService();
const settingsService = new SettingsService();
const aiService = new AiService();
const reportService = new ReportService();
const dataService = new DataService();
const projectRepository = new ProjectRepository();

interface IpcOk<T> {
  ok: true;
  data: T;
}

interface IpcFail {
  ok: false;
  error: ReturnType<typeof serializeError>;
}

function handle<TPayload, TResult>(channel: string, fn: (payload: TPayload) => Promise<TResult> | TResult): void {
  ipcMain.handle(channel, async (_event, payload: TPayload): Promise<IpcOk<TResult> | IpcFail> => {
    try {
      return {
        ok: true,
        data: await fn(payload)
      };
    } catch (error) {
      return {
        ok: false,
        error: serializeError(error)
      };
    }
  });
}

export function registerIpcHandlers(): void {
  handle<CreateTaskInput, unknown>('task:create', (payload) => taskService.create(payload));
  handle<{ id: string; patch: UpdateTaskInput }, unknown>('task:update', ({ id, patch }) => taskService.update(id, patch));
  handle<{ id: string }, unknown>('task:remove', ({ id }) => taskService.remove(id));
  handle<{ id: string }, unknown>('task:get', ({ id }) => taskService.get(id));
  handle<TaskListQuery, unknown>('task:list', (payload) => taskService.list(payload));
  handle<{ id: string }, unknown>('task:polish', ({ id }) => taskService.polish(id));
  handle<{ ids: string[] }, unknown>('task:batch-polish', ({ ids }) => taskService.batchPolish(ids));

  handle<void, unknown>('settings:get-all', () => settingsService.getAll());
  handle<UpdateSettingsInput, unknown>('settings:update', (payload) => settingsService.update(payload));
  handle<UpdateSettingsInput['ai'], unknown>('settings:test-ai', (payload) => aiService.testConnection(payload));

  handle<WeeklyReportQuery, unknown>('report:generate-weekly', (payload) => reportService.generateWeekly(payload));
  handle<ExportMarkdownInput, unknown>('report:export-markdown', (payload) => reportService.exportMarkdown(payload));
  handle<{ text: string }, unknown>('clipboard:write-text', ({ text }) => {
    clipboard.writeText(text);
    return { success: true };
  });
  handle<void, unknown>('data:backup', () => dataService.backupDatabase());
  handle<void, unknown>('data:restore', () => dataService.restoreDatabase());
  handle<void, unknown>('data:get-database-path', () => dataService.getDatabasePath());
  handle<void, unknown>('app:get-info', () => ({
    name: app.getName(),
    version: app.getVersion()
  }));

  handle<CreateProjectInput, unknown>('project:create', (payload) => projectRepository.create(payload));
  handle<{ id: string; patch: UpdateProjectInput }, unknown>('project:update', ({ id, patch }) => projectRepository.update(id, patch));
  handle<{ id: string }, unknown>('project:remove', ({ id }) => projectRepository.remove(id).then(() => ({ success: true })));
  handle<void, unknown>('project:list', () => projectRepository.list());
}
