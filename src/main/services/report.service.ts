import { dialog } from 'electron';
import { DEFAULT_WEEKLY_TEMPLATE } from '@shared/constants';
import { getPeriodRange } from '@shared/date';
import type { ExportMarkdownInput, ExportResult, TaskRecord, WeeklyReport, WeeklyReportQuery } from '@shared/types';
import { TaskRepository } from '@main/repositories/task.repository';
import { SettingsService } from './settings.service';

const taskRepository = new TaskRepository();
const settingsService = new SettingsService();

export class ReportService {
  async generateWeekly(query: WeeklyReportQuery): Promise<WeeklyReport> {
    const settings = await settingsService.getAll();
    const range = getPeriodRange('week', query.baseDate, settings.app.weekStartDay);
    const result = await taskRepository.list({
      startDate: range.startDate,
      endDate: range.endDate,
      limit: 500
    });
    const content = renderWeeklyReport(result.items, settings.report.weeklyTemplate || DEFAULT_WEEKLY_TEMPLATE, {
      startDate: range.startDate ?? '',
      endDate: range.endDate ?? ''
    });

    return {
      title: `周报（${range.startDate} - ${range.endDate}）`,
      startDate: range.startDate ?? '',
      endDate: range.endDate ?? '',
      content,
      taskCount: result.total
    };
  }

  async exportMarkdown(input: ExportMarkdownInput): Promise<ExportResult> {
    const result = await dialog.showSaveDialog({
      title: '导出周报',
      defaultPath: input.defaultFileName,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const fs = await import('node:fs/promises');
    await fs.writeFile(result.filePath, input.content, 'utf8');
    return {
      success: true,
      filePath: result.filePath
    };
  }
}

function renderWeeklyReport(
  tasks: TaskRecord[],
  template: string,
  range: { startDate: string; endDate: string }
): string {
  const completed = tasks.filter((task) => task.status === 'completed');
  const inProgress = tasks.filter((task) => task.status === 'in_progress' || task.status === 'paused');
  const planned = tasks.filter((task) => task.status === 'planned');

  return template
    .replaceAll('{startDate}', range.startDate)
    .replaceAll('{endDate}', range.endDate)
    .replaceAll('{completedItems}', formatItems(completed))
    .replaceAll('{inProgressItems}', formatItems(inProgress))
    .replaceAll('{plannedItems}', formatItems(planned))
    .replaceAll('{riskItems}', '暂无');
}

function formatItems(tasks: TaskRecord[]): string {
  if (!tasks.length) {
    return '暂无';
  }

  return tasks.map((task) => `- ${task.polishedContent || task.rawContent}`).join('\n');
}
