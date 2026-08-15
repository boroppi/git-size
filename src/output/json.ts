import type { RepositoryReport } from '../types.js';

export function renderJson(report: RepositoryReport): string {
  return JSON.stringify(report, null, 2);
}