import { describe, expect, it } from 'vitest';

import { parseCliArgs } from '../src/args.js';

describe('CLI arguments', () => {
  it('parses documented hyphenated threshold flags', () => {
    expect(
      parseCliArgs(['--largest', '20', '--max-file-size', '10MB', '--max-repo-size', '500MB']),
    ).toMatchObject({
      largest: 20,
      maxFileSize: 10 * 1024 ** 2,
      maxRepositorySize: 500 * 1024 ** 2,
    });
  });

  it('rejects conflicting output modes', () => {
    expect(() => parseCliArgs(['--json', '--ci'])).toThrow(/cannot be used together/);
  });

  it('rejects invalid size and count values', () => {
    expect(() => parseCliArgs(['--largest', 'nope'])).toThrow(/positive whole number/);
    expect(() => parseCliArgs(['--largest', '0'])).toThrow(/between 1 and 10000/);
    expect(() => parseCliArgs(['--max-file-size', 'huge'])).toThrow(/Invalid size/);
  });
});