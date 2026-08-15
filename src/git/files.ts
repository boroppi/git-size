import type { RepositoryInfo, TrackedFile } from '../types.js';
import { listTrackedFiles } from './repository.js';

export async function getAnalyzableFiles(
  repository: RepositoryInfo,
  shouldIgnore: (path: string) => boolean,
): Promise<{
  readonly files: readonly TrackedFile[];
  readonly missing: readonly { path: string }[];
}> {
  const result = await listTrackedFiles(repository);
  return {
    files: result.files.filter((file) => !shouldIgnore(file.path)),
    missing: result.missing.filter((file) => !shouldIgnore(file.path)),
  };
}