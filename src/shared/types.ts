export type TaskStatus = 'completed' | 'in_progress' | 'planned' | 'paused' | 'canceled';
export type AiStatus = 'pending' | 'generating' | 'succeeded' | 'failed';
export type Priority = 'low' | 'medium' | 'high';
export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'all';
export type OutputStyle = 'concise' | 'formal' | 'quantified' | 'managerial';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  rawContent: string;
  polishedContent: string | null;
  status: TaskStatus;
  recordDate: string;
  projectId: string | null;
  projectName?: string | null;
  tags: string[];
  priority: Priority | null;
  aiModel: string | null;
  aiStatus: AiStatus;
  aiError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  rawContent: string;
  polishedContent?: string | null;
  status: TaskStatus;
  recordDate: string;
  projectId?: string | null;
  tags?: string[];
  priority?: Priority | null;
}

export interface UpdateTaskInput {
  rawContent?: string;
  polishedContent?: string | null;
  status?: TaskStatus;
  recordDate?: string;
  projectId?: string | null;
  tags?: string[];
  priority?: Priority | null;
}

export interface TaskListQuery {
  periodType?: PeriodType;
  baseDate?: string;
  startDate?: string;
  endDate?: string;
  statuses?: TaskStatus[];
  projectId?: string | null;
  tags?: string[];
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface TaskListResult {
  items: TaskRecord[];
  total: number;
}

export interface AiPublicConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  outputStyle: OutputStyle;
  hasApiKey: boolean;
  apiKeyMasked: string;
}

export interface AiConfig extends AiPublicConfig {
  apiKey: string;
}

export interface UpdateAiSettingsInput {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  outputStyle?: OutputStyle;
}

export interface AppSettings {
  ai: AiPublicConfig;
  app: {
    weekStartDay: number;
  };
  task: {
    defaultStatus: TaskStatus;
  };
  report: {
    weeklyTemplate: string;
  };
}

export interface UpdateSettingsInput {
  ai?: UpdateAiSettingsInput;
  app?: Partial<AppSettings['app']>;
  task?: Partial<AppSettings['task']>;
  report?: Partial<AppSettings['report']>;
}

export interface AiTestResult {
  success: boolean;
  message: string;
  sample?: string;
  durationMs?: number;
}

export interface PolishTaskInput {
  rawContent: string;
  status: TaskStatus;
  recordDate: string;
  projectName?: string | null;
}

export interface PolishTaskResult {
  content: string;
  model: string;
  durationMs: number;
}

export interface WeeklyReportQuery {
  baseDate: string;
}

export interface WeeklyReport {
  title: string;
  startDate: string;
  endDate: string;
  content: string;
  taskCount: number;
}

export interface ExportMarkdownInput {
  defaultFileName: string;
  content: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
}

export interface DataOperationResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  message?: string;
}

export interface AppInfo {
  name: string;
  version: string;
}

export interface BatchPolishResult {
  successCount: number;
  failedCount: number;
}

export interface AppErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  color?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string | null;
}
