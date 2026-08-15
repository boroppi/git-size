import { describe, expect, it } from 'vitest';

import { aggregateDirectories } from '../src/analysis/directories.js';

describe('aggregateDirectories', () => {
  it('aggregates each ancestor without double-counting within a directory', () => {
    expect(
      aggregateDirectories([
        { path: 'src/a.ts', size: 10, kind: 'file' },
        { path: 'src/lib/b.ts', size: 20, kind: 'file' },
        { path: 'assets/logo.png', size: 5, kind: 'file' },
      ]),
    ).toEqual([
      { path: 'src/', size: 30 },
      { path: 'src/lib/', size: 20 },
      { path: 'assets/', size: 5 },
    ]);
  });
});