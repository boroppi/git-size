import { describe, expect, it } from 'vitest';

import { getLimitViolations } from '../src/analysis/files.js';
import type { AnalysisConfig, RepositoryReport, TrackedFile } from '../src/types.js';

const files: readonly TrackedFile[] = [
  { path: 'public/video.mp4', size: 20, kind: 'file' },
  { path: 'src/app.ts', size: 5, kind: 'file' },
  { path: 'assets/logo.png', size: 8, kind: 'file' },
];

const report: RepositoryReport = {
  repository: {
    path: '/tmp/demo',
    name: 'demo',
    branch: 'main',
    gitDirectory: '/tmp/demo/.git',
    hasCommits: true,
  },
  sizes: {
    workingTree: 33,
    gitDirectory: 10,
    total: 43,
  },
  trackedFileCount: 3,
  missingTrackedFiles: [],
  directoryCount: 3,
  largestFiles: files,
  largestDirectories: [
    { path: 'public/', size: 20 },
    { path: 'assets/', size: 8 },
    { path: 'src/', size: 5 },
  ],
  fileTypes: [
    { category: 'Video', size: 20, count: 1 },
    { category: 'Images', size: 8, count: 1 },
    { category: 'TypeScript', size: 5, count: 1 },
  ],
  extensions: [
    { extension: '.mp4', category: 'Video', size: 20, count: 1 },
    { extension: '.png', category: 'Images', size: 8, count: 1 },
    { extension: '.ts', category: 'TypeScript', size: 5, count: 1 },
  ],
  warnings: [{ path: 'public/video.mp4', size: 20, message: 'public/video.mp4 is 20 B' }],
  recommendations: [],
};

describe('file aggregation', () => {
  it('orders largest files and totals tracked bytes', () => {
    const ordered = [...files].sort((a, b) => b.size - a.size);
    expect(ordered[0]?.path).toBe('public/video.mp4');
    expect(ordered.reduce((total, file) => total + file.size, 0)).toBe(33);
    expect(report.largestDirectories[0]?.path).toBe('public/');
  });
});

describe('CI limit violations', () => {
  const config: AnalysisConfig = {
    largestFiles: 10,
    warningThreshold: 10,
    maxFileSize: 10,
    maxRepositorySize: 40,
    ignore: [],
  };

  it('reports files and repository totals that exceed configured limits', () => {
    expect(getLimitViolations(report, config, files)).toEqual([
      'file public/video.mp4 (20 B) exceeds the maximum file size of 10 B',
      'repository total (43 B) exceeds the maximum repository size of 40 B',
    ]);
  });

  it('returns no violations when limits are not exceeded', () => {
    expect(
      getLimitViolations(report, {
        ...config,
        maxFileSize: 100,
        maxRepositorySize: 100,
      }, files),
    ).toEqual([]);
  });

  it('can derive file violations from warnings when the full file list is omitted', () => {
    expect(getLimitViolations(report, { ...config, maxRepositorySize: undefined })).toEqual([
      'file public/video.mp4 (20 B) exceeds the maximum file size of 10 B',
    ]);
  });
});
