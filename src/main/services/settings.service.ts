import { DEFAULT_WEEKLY_TEMPLATE } from '@shared/constants';
import type { AiConfig, AppSettings, UpdateSettingsInput } from '@shared/types';
import { AppError } from '@main/errors';
import { SettingsRepository } from '@main/repositories/settings.repository';
import { decryptSecret, encryptSecret, maskSecret } from '@main/security/secure-store';

const repo = new SettingsRepository();

const DEFAULT_AI = {
  baseUrl: '',
  model: '',
  temperature: 0.3,
  maxTokens: 300,
  timeoutMs: 60000,
  outputStyle: 'concise' as const
};

const SETTING_KEYS = {
  aiBaseUrl: 'ai.baseUrl',
  aiApiKey: 'ai.apiKey',
  aiModel: 'ai.model',
  aiTemperature: 'ai.temperature',
  aiMaxTokens: 'ai.maxTokens',
  aiTimeoutMs: 'ai.timeoutMs',
  aiOutputStyle: 'ai.outputStyle',
  appWeekStartDay: 'app.weekStartDay',
  taskDefaultStatus: 'task.defaultStatus',
  reportWeeklyTemplate: 'report.weeklyTemplate'
};

export class SettingsService {
  async getAll(): Promise<AppSettings> {
    const rows = await repo.getMany(Object.values(SETTING_KEYS));
    const apiKey = decryptSecret(rows.get(SETTING_KEYS.aiApiKey)?.value ?? null);

    return {
      ai: {
        baseUrl: readString(rows, SETTING_KEYS.aiBaseUrl, DEFAULT_AI.baseUrl),
        model: readString(rows, SETTING_KEYS.aiModel, DEFAULT_AI.model),
        temperature: readNumber(rows, SETTING_KEYS.aiTemperature, DEFAULT_AI.temperature),
        maxTokens: readNumber(rows, SETTING_KEYS.aiMaxTokens, DEFAULT_AI.maxTokens),
        timeoutMs: readNumber(rows, SETTING_KEYS.aiTimeoutMs, DEFAULT_AI.timeoutMs),
        outputStyle: readString(rows, SETTING_KEYS.aiOutputStyle, DEFAULT_AI.outputStyle) as AppSettings['ai']['outputStyle'],
        hasApiKey: Boolean(apiKey),
        apiKeyMasked: maskSecret(apiKey)
      },
      app: {
        weekStartDay: readNumber(rows, SETTING_KEYS.appWeekStartDay, 1)
      },
      task: {
        defaultStatus: readString(rows, SETTING_KEYS.taskDefaultStatus, 'completed') as AppSettings['task']['defaultStatus']
      },
      report: {
        weeklyTemplate: readString(rows, SETTING_KEYS.reportWeeklyTemplate, DEFAULT_WEEKLY_TEMPLATE)
      }
    };
  }

  async getAiConfig(): Promise<AiConfig> {
    const rows = await repo.getMany(Object.values(SETTING_KEYS));
    const apiKey = decryptSecret(rows.get(SETTING_KEYS.aiApiKey)?.value ?? null);
    return {
      baseUrl: readString(rows, SETTING_KEYS.aiBaseUrl, DEFAULT_AI.baseUrl),
      apiKey,
      model: readString(rows, SETTING_KEYS.aiModel, DEFAULT_AI.model),
      temperature: readNumber(rows, SETTING_KEYS.aiTemperature, DEFAULT_AI.temperature),
      maxTokens: readNumber(rows, SETTING_KEYS.aiMaxTokens, DEFAULT_AI.maxTokens),
      timeoutMs: readNumber(rows, SETTING_KEYS.aiTimeoutMs, DEFAULT_AI.timeoutMs),
      outputStyle: readString(rows, SETTING_KEYS.aiOutputStyle, DEFAULT_AI.outputStyle) as AiConfig['outputStyle'],
      hasApiKey: Boolean(apiKey),
      apiKeyMasked: maskSecret(apiKey)
    };
  }

  async update(input: UpdateSettingsInput): Promise<AppSettings> {
    if (input.ai) {
      await this.updateAi(input.ai);
    }

    if (input.app?.weekStartDay !== undefined) {
      const value = Number(input.app.weekStartDay);
      if (Number.isNaN(value) || value < 0 || value > 6) {
        throw new AppError('VALIDATION_ERROR', '每周起始日必须在 0 到 6 之间');
      }
      await repo.set(SETTING_KEYS.appWeekStartDay, String(value));
    }

    if (input.task?.defaultStatus) {
      await repo.set(SETTING_KEYS.taskDefaultStatus, input.task.defaultStatus);
    }

    if (input.report?.weeklyTemplate !== undefined) {
      await repo.set(SETTING_KEYS.reportWeeklyTemplate, input.report.weeklyTemplate);
    }

    return this.getAll();
  }

  private async updateAi(input: NonNullable<UpdateSettingsInput['ai']>): Promise<void> {
    if (input.baseUrl !== undefined) {
      await repo.set(SETTING_KEYS.aiBaseUrl, input.baseUrl.trim());
    }
    if (input.model !== undefined) {
      await repo.set(SETTING_KEYS.aiModel, input.model.trim());
    }
    if (input.temperature !== undefined) {
      await repo.set(SETTING_KEYS.aiTemperature, String(input.temperature));
    }
    if (input.maxTokens !== undefined) {
      await repo.set(SETTING_KEYS.aiMaxTokens, String(input.maxTokens));
    }
    if (input.timeoutMs !== undefined) {
      await repo.set(SETTING_KEYS.aiTimeoutMs, String(input.timeoutMs));
    }
    if (input.outputStyle !== undefined) {
      await repo.set(SETTING_KEYS.aiOutputStyle, input.outputStyle);
    }
    if (input.apiKey !== undefined) {
      const encrypted = encryptSecret(input.apiKey.trim());
      await repo.set(SETTING_KEYS.aiApiKey, encrypted.value, encrypted.encrypted);
    }
  }
}

function readString(rows: Map<string, { value: string | null }>, key: string, fallback: string): string {
  return rows.get(key)?.value ?? fallback;
}

function readNumber(rows: Map<string, { value: string | null }>, key: string, fallback: number): number {
  const value = Number(rows.get(key)?.value);
  return Number.isFinite(value) ? value : fallback;
}
