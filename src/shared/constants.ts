import type { AiStatus, OutputStyle, Priority, TaskStatus } from './types';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  planned: '计划中',
  paused: '暂停',
  canceled: '取消'
};

export const AI_STATUS_LABELS: Record<AiStatus, string> = {
  pending: '未生成',
  generating: '生成中',
  succeeded: '已生成',
  failed: '生成失败'
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高'
};

export const OUTPUT_STYLE_LABELS: Record<OutputStyle, string> = {
  concise: '简洁',
  formal: '正式',
  quantified: '量化',
  managerial: '管理汇报'
};

export const DEFAULT_WEEKLY_TEMPLATE = `# 周报（{startDate} - {endDate}）

## 本周完成

{completedItems}

## 进行中

{inProgressItems}

## 下周计划

{plannedItems}
`;
