import { contextBridge, ipcRenderer } from 'electron';
import type {
  AiTestResult,
  AppInfo,
  AppErrorPayload,
  AppSettings,
  BatchPolishResult,
  CreateProjectInput,
  CreateTaskInput,
  DataOperationResult,
  ExportMarkdownInput,
  ExportResult,
  Project,
  TaskListQuery,
  TaskListResult,
  TaskRecord,
  UpdateProjectInput,
  UpdateSettingsInput,
  UpdateTaskInput,
  WeeklyReport,
  WeeklyReportQuery
} from '@shared/types';

interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: AppErrorPayload;
}

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>;
  if (!result.ok) {
    const error = new Error(result.error?.message ?? '操作失败');
    Object.assign(error, result.error);
    throw error;
  }
  return result.data as T;
}

const api = {
  tasks: {
    create: (input: CreateTaskInput) => invoke<TaskRecord>('task:create', input),
    update: (id: string, patch: UpdateTaskInput) => invoke<TaskRecord>('task:update', { id, patch }),
    remove: (id: string) => invoke<{ success: boolean }>('task:remove', { id }),
    get: (id: string) => invoke<TaskRecord>('task:get', { id }),
    list: (query: TaskListQuery) => invoke<TaskListResult>('task:list', query),
    polish: (id: string) => invoke<TaskRecord>('task:polish', { id }),
    batchPolish: (ids: string[]) => invoke<BatchPolishResult>('task:batch-polish', { ids })
  },
  reports: {
    generateWeekly: (query: WeeklyReportQuery) => invoke<WeeklyReport>('report:generate-weekly', query),
    exportMarkdown: (input: ExportMarkdownInput) => invoke<ExportResult>('report:export-markdown', input)
  },
  settings: {
    getAll: () => invoke<AppSettings>('settings:get-all'),
    update: (input: UpdateSettingsInput) => invoke<AppSettings>('settings:update', input),
    testAiConnection: (input?: UpdateSettingsInput['ai']) => invoke<AiTestResult>('settings:test-ai', input)
  },
  projects: {
    create: (input: CreateProjectInput) => invoke<Project>('project:create', input),
    update: (id: string, patch: UpdateProjectInput) => invoke<Project>('project:update', { id, patch }),
    remove: (id: string) => invoke<{ success: boolean }>('project:remove', { id }),
    list: () => invoke<Project[]>('project:list')
  },
  clipboard: {
    writeText: (text: string) => invoke<{ success: boolean }>('clipboard:write-text', { text })
  },
  data: {
    backup: () => invoke<DataOperationResult>('data:backup'),
    restore: () => invoke<DataOperationResult>('data:restore'),
    getDatabasePath: () => invoke<{ path: string }>('data:get-database-path')
  },
  app: {
    getInfo: () => invoke<AppInfo>('app:get-info'),
    onFocusQuickInput: (callback: () => void) => {
      const listener = (): void => callback();
      ipcRenderer.on('app:focus-quick-input', listener);
      return () => {
        ipcRenderer.removeListener('app:focus-quick-input', listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld('weeklyReport', api);

export type WeeklyReportDesktopApi = typeof api;
