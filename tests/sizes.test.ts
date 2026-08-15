import { describe, expect, it } from 'vitest';

import { formatBytes, parseSize } from '../src/utils/sizes.js';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1.5 * 1024 ** 2, '1.5 MB'],
    [10 * 1024 ** 3, '10 GB'],
    [100 * 1024, '100 KB'],
    [230 * 1024, '230 KB'],
    [1024 * 10, '10 KB'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatBytes(value)).toBe(expected);
  });
});

describe('parseSize', () => {
  it.each([
    ['10MB', 10 * 1024 ** 2],
    ['500KB', 500 * 1024],
    ['1GB', 1024 ** 3],
    ['1.5 MiB', 1.5 * 1024 ** 2],
    ['512', 512],
  ])('parses %s', (value, expected) => {
    expect(parseSize(value)).toBe(expected);
  });

  it.each(['', '0MB', '-1MB', 'ten MB', '1XB'])('rejects %s', (value) => {
    expect(() => parseSize(value)).toThrow();
  });
});