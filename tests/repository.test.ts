import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { analyzeRepository } from '../src/analysis/files.js';
import { detectRepository, listTrackedFiles } from '../src/git/repository.js';

const execFile = promisify(execFileCallback);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('real Git repositories', () => {
  it('detects a repository from a nested directory and preserves special filenames', async () => {
    const directory = await createRepository();
    const nested = join(directory, 'nested');
    await mkdir(nested);
    const specialPath = join(directory, 'docs', 'space and café.txt');
    await mkdir(join(directory, 'docs'));
    await writeFile(specialPath, 'hello');
    await writeFile(join(directory, 'src.ts'), 'const answer = 42;');
    await git(directory, ['add', '.']);
    await git(directory, ['-c', 'user.name=git-size test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial']);

    const repository = await detectRepository(nested);
    expect(repository.path).toBe(directory);
    expect(repository.branch).not.toBe('No commits yet');

    const tracked = await listTrackedFiles(repository);
    expect(tracked.missing).toEqual([]);
    expect(tracked.files.map((file) => file.path)).toEqual(['docs/space and café.txt', 'src.ts']);

    const report = await analyzeRepository(
      repository,
      {
        largestFiles: 10,
        warningThreshold: 1,
        ignore: [],
      },
      true,
    );
    expect(report.trackedFileCount).toBe(2);
    expect(report.sizes.workingTree).toBeGreaterThan(0);
    expect(report.largestDirectories[0]?.path).toBe('docs/');
    expect(report.history?.objectCount).toBeGreaterThan(0);
    expect(report.largestFiles.map((file) => file.path)).toEqual(['src.ts', 'docs/space and café.txt']);
    expect(report.largestFiles[0]?.size ?? 0).toBeGreaterThan(report.largestFiles[1]?.size ?? 0);
  });

  it('keeps deleted large files visible in history and honors ignore patterns', async () => {
    const directory = await createRepository();
    await writeFile(join(directory, 'keep.ts'), 'export const keep = true;\n');
    await writeFile(join(directory, 'gone.bin'), 'y'.repeat(2048));
    await mkdir(join(directory, 'coverage'));
    await writeFile(join(directory, 'coverage', 'lcov.info'), 'coverage');
    await git(directory, ['add', '.']);
    await git(directory, [
      '-c',
      'user.name=git-size test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'add files',
    ]);
    await git(directory, ['rm', 'gone.bin']);
    await git(directory, [
      '-c',
      'user.name=git-size test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'remove large file',
    ]);

    const repository = await detectRepository(directory);
    const report = await analyzeRepository(
      repository,
      {
        largestFiles: 10,
        warningThreshold: 10 * 1024 ** 2,
        ignore: ['coverage/**'],
      },
      true,
    );

    expect(report.largestFiles.map((file) => file.path)).toEqual(['keep.ts']);
    expect(report.history?.largestObjects.some((object) => object.path === 'gone.bin')).toBe(true);
    expect(report.history?.notes.some((note) => /deleted files may still exist/i.test(note))).toBe(true);
  });

  it('rejects a directory that is not a Git repository', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'git-size-nongit-'));
    temporaryDirectories.push(directory);
    await expect(detectRepository(directory)).rejects.toThrow(/Not a Git repository/);
  });

  it('handles an empty repository', async () => {
    const directory = await createRepository();
    const repository = await detectRepository(directory);
    expect(repository.hasCommits).toBe(false);
    expect(repository.branch).not.toBe('');
    const report = await analyzeRepository(
      repository,
      { largestFiles: 10, warningThreshold: 10 * 1024 ** 2, ignore: [] },
      true,
    );
    expect(report.history?.objectCount).toBe(0);
  });
});

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'git-size-repo-'));
  temporaryDirectories.push(directory);
  await git(directory, ['init', '-b', 'main']);
  return directory;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFile('git', [...args], { cwd });
}