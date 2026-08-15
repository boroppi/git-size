import type { Dirent } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import { mapLimit } from '../utils/concurrency.js';
import { CliError } from '../utils/errors.js';
import type { MissingTrackedFile, RepositoryInfo, TrackedFile } from '../types.js';
import { GitCommandError, runGit } from './command.js';

const STAT_CONCURRENCY = 32;

export interface TrackedFileResult {
  readonly files: readonly TrackedFile[];
  readonly missing: readonly MissingTrackedFile[];
}

export async function detectRepository(startDirectory = process.cwd()): Promise<RepositoryInfo> {
  let root: string;
  try {
    root = (await runGit(['rev-parse', '--show-toplevel'], startDirectory)).trim();
  } catch (error) {
    if (error instanceof GitCommandError && error.code === 'ENOENT') {
      throw new CliError('Git is not installed or is not available on your PATH.');
    }
    throw new CliError('Not a Git repository.\n\nRun git-size from inside a Git repository.');
  }

  if (!root) {
    throw new CliError('Git returned an empty repository root.');
  }

  root = resolve(root);
  const gitDirectoryValue = (await runGit(['rev-parse', '--git-dir'], root)).trim();
  const gitDirectory = resolve(
    isAbsolute(gitDirectoryValue) ? gitDirectoryValue : join(root, gitDirectoryValue),
  );
  const branch = await getBranch(root);
  const hasCommits = await hasHead(root);
  const name = basename(root) || dirname(root);

  return {
    path: root,
    name,
    branch,
    gitDirectory,
    hasCommits,
  };
}

export async function listTrackedFiles(repository: RepositoryInfo): Promise<TrackedFileResult> {
  const output = await runGit(['ls-files', '--cached', '--full-name', '-z'], repository.path);
  const paths = output.split('\0').filter(Boolean);
  const files: TrackedFile[] = [];
  const missing: MissingTrackedFile[] = [];

  await mapLimit(paths, STAT_CONCURRENCY, async (relativePath) => {
    const absolutePath = join(repository.path, ...relativePath.split('/'));
    try {
      const stats = await lstat(absolutePath);
      if (stats.isFile() || stats.isSymbolicLink()) {
        files.push({
          path: relativePath,
          size: stats.size,
          kind: stats.isSymbolicLink() ? 'symlink' : 'file',
        });
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        missing.push({ path: relativePath });
      } else {
        throw error;
      }
    }
  });

  files.sort((a, b) => a.path.localeCompare(b.path));
  missing.sort((a, b) => a.path.localeCompare(b.path));
  return { files, missing };
}

export async function directorySize(directory: string): Promise<number> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }

  const sizes = await mapLimit(entries, STAT_CONCURRENCY, async (entry) => {
    const path = join(directory, entry.name);
    try {
      if (entry.isSymbolicLink()) {
        const stats = await lstat(path);
        return stats.size;
      }
      if (entry.isDirectory()) {
        return directorySize(path);
      }
      const stats = await lstat(path);
      return stats.size;
    } catch {
      return 0;
    }
  });
  return sizes.reduce((total, size) => total + size, 0);
}

async function getBranch(root: string): Promise<string> {
  try {
    return (await runGit(['symbolic-ref', '--short', 'HEAD'], root)).trim() || 'Detached HEAD';
  } catch {
    try {
      const commit = (await runGit(['rev-parse', '--short', 'HEAD'], root)).trim();
      return commit ? `Detached HEAD at ${commit}` : 'No commits yet';
    } catch {
      return 'No commits yet';
    }
  }
}

async function hasHead(root: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--verify', 'HEAD'], root);
    return true;
  } catch {
    return false;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ((error as { code?: string }).code === 'ENOENT' ||
      (error as { code?: string }).code === 'ENOTDIR')
  );
}