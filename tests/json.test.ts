import { describe, expect, it } from 'vitest';

import { renderJson } from '../src/output/json.js';
import { renderTerminal } from '../src/output/terminal.js';
import type { CliOptions, RepositoryReport } from '../src/types.js';

const report: RepositoryReport = {
  repository: {
    path: '/tmp/demo',
    name: 'demo',
    branch: 'main',
    gitDirectory: '/tmp/demo/.git',
    hasCommits: true,
  },
  sizes: {
    workingTree: 18400000,
    gitDirectory: 18300000,
    total: 36700000,
  },
  trackedFileCount: 2,
  missingTrackedFiles: [],
  directoryCount: 1,
  largestFiles: [{ path: 'public/video.mp4', size: 18400000, kind: 'file' }],
  largestDirectories: [{ path: 'public/', size: 18400000 }],
  fileTypes: [{ category: 'Video', size: 18400000, count: 1 }],
  extensions: [{ extension: '.mp4', category: 'Video', size: 18400000, count: 1 }],
  warnings: [{ path: 'public/video.mp4', size: 18400000, message: 'public/video.mp4 is 17.5 MB' }],
  recommendations: ['Consider Git LFS for large binary assets that do not belong in regular Git objects.'],
};

describe('JSON output', () => {
  it('renders structured data rather than terminal strings', () => {
    const parsed = JSON.parse(renderJson(report)) as RepositoryReport;
    expect(parsed).toMatchObject({
      repository: {
        path: '/tmp/demo',
        name: 'demo',
        branch: 'main',
      },
      sizes: {
        workingTree: 18400000,
        gitDirectory: 18300000,
        total: 36700000,
      },
      trackedFileCount: 2,
      largestFiles: [{ path: 'public/video.mp4', size: 18400000, kind: 'file' }],
      fileTypes: [{ category: 'Video', size: 18400000, count: 1 }],
      extensions: [{ extension: '.mp4', category: 'Video', size: 18400000, count: 1 }],
      warnings: [{ path: 'public/video.mp4', size: 18400000 }],
    });
    expect(typeof parsed.largestFiles[0]?.size).toBe('number');
  });
});

describe('terminal output', () => {
  it('prints a concise CI summary without decoration', () => {
    const options: CliOptions = {
      help: false,
      version: false,
      history: false,
      json: false,
      ci: true,
    };
    const output = renderTerminal(report, options);
    expect(output).toContain('git-size: demo');
    expect(output).toContain('files=2');
    expect(output).not.toContain('Largest tracked files');
    expect(output).not.toContain('\u001b[');
  });
});
