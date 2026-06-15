import type { AiConfig, AiTestResult, PolishTaskInput, PolishTaskResult } from '@shared/types';
import { OUTPUT_STYLE_LABELS, TASK_STATUS_LABELS } from '@shared/constants';
import { AppError } from '@main/errors';
import { SettingsService } from './settings.service';

const settingsService = new SettingsService();

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class AiService {
  async testConnection(override?: Partial<AiConfig>): Promise<AiTestResult> {
    const stored = await settingsService.getAiConfig();
    const config = { ...stored, ...override };
    validateConfig(config);

    const startedAt = Date.now();
    try {
      const content = await requestChatCompletion(config, [
        {
          role: 'system',
          content: buildSystemPrompt(config)
        },
        {
          role: 'user',
          content: '任务状态：已完成\n原始记录：修复登录问题\n\n请输出一条周报可用任务描述。'
        }
      ]);

      return {
        success: true,
        message: '连接成功',
        sample: content,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'AI 连接测试失败';
      return {
        success: false,
        message,
        durationMs: Date.now() - startedAt
      };
    }
  }

  async polishTask(input: PolishTaskInput): Promise<PolishTaskResult> {
    const config = await settingsService.getAiConfig();
    validateConfig(config);

    const startedAt = Date.now();
    const content = await requestChatCompletion(config, [
      {
        role: 'system',
        content: buildSystemPrompt(config)
      },
      {
        role: 'user',
        content: buildUserPrompt(input)
      }
    ]);

    return {
      content,
      model: config.model,
      durationMs: Date.now() - startedAt
    };
  }
}

function validateConfig(config: AiConfig): void {
  if (!config.baseUrl.trim() || !config.model.trim() || !config.apiKey.trim()) {
    throw new AppError('AI_CONFIG_MISSING', 'AI 配置不完整，请先填写 API 地址、密钥和模型名称');
  }
}

function buildSystemPrompt(config: AiConfig): string {
  return `你是一个工作周报整理助手。请将用户输入的口语化工作记录，改写为适合周报使用的一条正式工作任务描述。

要求：
1. 保留原始含义，不编造事实。
2. 表达简洁、正式、结果导向。
3. 输出一条中文任务描述，不要解释。
4. 根据用户标记的状态调整措辞：已完成、进行中、计划中、暂停、取消。
5. 如果原文信息不足，保持概括，不要补充不存在的细节。
6. 避免无依据的夸大描述，例如“显著提升”“全面优化”。
7. 当前输出风格：${OUTPUT_STYLE_LABELS[config.outputStyle]}。`;
}

function buildUserPrompt(input: PolishTaskInput): string {
  const projectLine = input.projectName ? `项目：${input.projectName}\n` : '';
  return `任务状态：${TASK_STATUS_LABELS[input.status]}
记录日期：${input.recordDate}
${projectLine}原始记录：${input.rawContent}

请输出一条周报可用任务描述。`;
}

async function requestChatCompletion(
  config: AiConfig,
  messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(normalizeChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    const json = (await response.json()) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new AppError('AI_RESPONSE_INVALID', 'AI 返回内容为空或格式不兼容');
    }

    return content.replace(/^["“]|["”]$/g, '').trim();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError('AI_TIMEOUT', 'AI 请求超时，请检查网络或调整超时时间');
    }
    throw new AppError('AI_REQUEST_FAILED', error instanceof Error ? error.message : 'AI 请求失败');
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

function mapHttpError(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError('AI_AUTH_FAILED', 'API Key 无效或无权限');
  }
  if (status === 404) {
    return new AppError('AI_ENDPOINT_NOT_FOUND', 'AI API 地址可能不正确，请检查 Base URL');
  }
  if (status === 429) {
    return new AppError('AI_RATE_LIMITED', '请求过于频繁或额度不足');
  }
  if (status >= 500) {
    return new AppError('AI_SERVER_ERROR', 'AI 服务异常，请稍后重试');
  }
  return new AppError('AI_REQUEST_FAILED', `AI 请求失败，HTTP 状态码：${status}`);
}
