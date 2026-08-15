import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig, mergeConfig } from '../src/config.js';
import type { CliOptions } from '../src/types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('configuration', () => {
  it('loads a valid optional config', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'git-size-config-'));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, '.git-size.json'),
      JSON.stringify({ maxFileSize: '10MB', largestFiles: 20, ignore: ['coverage/**'] }),
    );

    await expect(loadConfig(directory)).resolves.toEqual({
      maxFileSize: 10 * 1024 ** 2,
      largestFiles: 20,
      ignore: ['coverage/**'],
    });
  });

  it('returns an empty config when the default file is absent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'git-size-config-'));
    temporaryDirectories.push(directory);
    await expect(loadConfig(directory)).resolves.toEqual({});
  });

  it('rejects invalid configuration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'git-size-config-'));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, '.git-size.json'), '{');
    await expect(loadConfig(directory)).rejects.toThrow(/invalid JSON/);

    await writeFile(join(directory, '.git-size.json'), JSON.stringify({ maxFileSize: 'nope' }));
    await expect(loadConfig(directory)).rejects.toThrow(/positive size/);

    await writeFile(join(directory, '.git-size.json'), JSON.stringify({ unknown: true }));
    await expect(loadConfig(directory)).rejects.toThrow(/unknown option/);
  });

  it('lets CLI values override file values', () => {
    const cli: CliOptions = {
      help: false,
      version: false,
      history: false,
      json: false,
      ci: false,
      largest: 5,
      maxFileSize: 100,
      maxRepositorySize: 200,
    };
    expect(
      mergeConfig({ largestFiles: 20, maxFileSize: 50, maxRepositorySize: 75 }, cli),
    ).toEqual({ largestFiles: 5, maxFileSize: 100, maxRepositorySize: 200 });
  });
});