import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { main } from '../src/cli.js';
import { helpText } from '../src/args.js';

const execFile = promisify(execFileCallback);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('CLI', () => {
  it('prints help and version without requiring a Git repository', async () => {
    const help: string[] = [];
    const version: string[] = [];
    expect(await main(['--help'], { stdout: { write: (chunk) => help.push(chunk) } })).toBe(0);
    expect(await main(['--version'], { stdout: { write: (chunk) => version.push(chunk) } })).toBe(0);
    expect(help.join('')).toContain('git-size — understand');
    expect(help.join('')).toBe(helpText());
    expect(version.join('').trim()).toBe('0.1.0');
  });

  it('returns a user-facing error outside a Git repository', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'git-size-cli-nongit-'));
    temporaryDirectories.push(directory);
    const stderr: string[] = [];
    const code = await main([], {
      cwd: directory,
      stdout: { write: () => undefined },
      stderr: { write: (chunk) => stderr.push(chunk) },
    });
    expect(code).toBe(2);
    expect(stderr.join('')).toMatch(/Not a Git repository/);
  });

  it('returns structured JSON and CI exit codes against a real repository', async () => {
    const directory = await createRepository();
    await mkdir(join(directory, 'docs'));
    await writeFile(join(directory, 'docs', 'space and café.txt'), 'hello');
    await writeFile(join(directory, 'src.ts'), 'const answer = 42;\n');
    await writeFile(join(directory, 'large.bin'), 'x'.repeat(64));
    await git(directory, ['add', '.']);
    await git(directory, [
      '-c',
      'user.name=git-size test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'initial',
    ]);

    const jsonChunks: string[] = [];
    const jsonCode = await main(['--json'], {
      cwd: directory,
      stdout: { write: (chunk) => jsonChunks.push(chunk) },
      stderr: { write: () => undefined },
    });
    expect(jsonCode).toBe(0);
    const parsed = JSON.parse(jsonChunks.join('')) as {
      trackedFileCount: number;
      sizes: { workingTree: number };
      largestFiles: { path: string; size: number }[];
    };
    expect(parsed.trackedFileCount).toBe(3);
    expect(parsed.sizes.workingTree).toBeGreaterThan(64);
    expect(parsed.largestFiles[0]?.path).toBe('large.bin');

    const failChunks: string[] = [];
    const failCode = await main(['--ci', '--max-file-size', '10B'], {
      cwd: directory,
      stdout: { write: () => undefined },
      stderr: { write: (chunk) => failChunks.push(chunk) },
    });
    expect(failCode).toBe(1);
    expect(failChunks.join('')).toMatch(/exceeds the maximum file size/);

    const passCode = await main(['--ci', '--max-file-size', '10MB'], {
      cwd: directory,
      stdout: { write: () => undefined },
      stderr: { write: () => undefined },
    });
    expect(passCode).toBe(0);
  });
});

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'git-size-cli-'));
  temporaryDirectories.push(directory);
  await git(directory, ['init', '-b', 'main']);
  return directory;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFile('git', [...args], { cwd });
}
