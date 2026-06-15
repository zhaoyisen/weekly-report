/// <reference types="vite/client" />

import type { WeeklyReportDesktopApi } from '../preload';

declare global {
  interface Window {
    weeklyReport: WeeklyReportDesktopApi;
  }
}

export {};
