import dayjs from 'dayjs';
import type { PeriodType } from './types';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export function todayString(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function formatDate(input: string): string {
  return dayjs(input).format('YYYY-MM-DD');
}

export function getPeriodRange(periodType: PeriodType, baseDate: string, weekStartDay = 1): DateRange {
  if (periodType === 'all') {
    return {};
  }

  const date = dayjs(baseDate || todayString());

  if (periodType === 'day') {
    return {
      startDate: date.format('YYYY-MM-DD'),
      endDate: date.format('YYYY-MM-DD')
    };
  }

  if (periodType === 'week') {
    const normalizedWeekStart = ((weekStartDay % 7) + 7) % 7;
    const diff = (date.day() - normalizedWeekStart + 7) % 7;
    const start = date.subtract(diff, 'day');
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: start.add(6, 'day').format('YYYY-MM-DD')
    };
  }

  if (periodType === 'month') {
    return {
      startDate: date.startOf('month').format('YYYY-MM-DD'),
      endDate: date.endOf('month').format('YYYY-MM-DD')
    };
  }

  return {
    startDate: date.startOf('year').format('YYYY-MM-DD'),
    endDate: date.endOf('year').format('YYYY-MM-DD')
  };
}

export function shiftBaseDate(periodType: PeriodType, baseDate: string, amount: number): string {
  const date = dayjs(baseDate || todayString());

  if (periodType === 'day') {
    return date.add(amount, 'day').format('YYYY-MM-DD');
  }

  if (periodType === 'week') {
    return date.add(amount, 'week').format('YYYY-MM-DD');
  }

  if (periodType === 'month') {
    return date.add(amount, 'month').format('YYYY-MM-DD');
  }

  if (periodType === 'year') {
    return date.add(amount, 'year').format('YYYY-MM-DD');
  }

  return date.format('YYYY-MM-DD');
}

export function getPeriodTitle(periodType: PeriodType, baseDate: string, weekStartDay = 1): string {
  const range = getPeriodRange(periodType, baseDate, weekStartDay);
  if (periodType === 'all') {
    return '全部记录';
  }
  if (periodType === 'day') {
    return range.startDate ?? todayString();
  }
  return `${range.startDate} 至 ${range.endDate}`;
}
