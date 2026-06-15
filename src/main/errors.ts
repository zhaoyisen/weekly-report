import type { AppErrorPayload } from '@shared/types';

export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  toPayload(): AppErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export function serializeError(error: unknown): AppErrorPayload {
  if (error instanceof AppError) {
    return error.toPayload();
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: '未知错误'
  };
}
