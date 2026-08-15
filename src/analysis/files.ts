import type { AnalysisConfig, RepositoryInfo, RepositoryReport, TrackedFile, Warning } from '../types.js';
import { aggregateDirectories } from './directories.js';
import { aggregateFileTypes } from './fileTypes.js';
import { getAnalyzableFiles } from '../git/files.js';
import { analyzeHistory } from '../git/history.js';
import { directorySize } from '../git/repository.js';
import { matchesAnyGlob } from '../utils/glob.js';
import { formatBytes } from '../utils/sizes.js';

export async function analyzeRepository(
  repository: RepositoryInfo,
  config: AnalysisConfig,
  includeHistory: boolean,
): Promise<RepositoryReport> {
  const filesResult = await getAnalyzableFiles(repository, (path) =>
    matchesIgnore(path, config.ignore),
  );
  const files = [...filesResult.files].sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
  const workingTree = files.reduce((total, file) => total + file.size, 0);
  const gitDirectory = await directorySize(repository.gitDirectory);
  const largestFiles = files.slice(0, config.largestFiles);
  const largestDirectories = aggregateDirectories(files).slice(0, config.largestFiles);
  const { fileTypes, extensions } = aggregateFileTypes(files);
  const warnings = createWarnings(files, config.warningThreshold);
  const recommendations = createRecommendations(files, warnings, repository);
  const history = includeHistory
    ? await analyzeHistory(repository, new Set(files.map((file) => file.path)))
    : undefined;

  return {
    repository,
    sizes: {
      workingTree,
      gitDirectory,
      total: workingTree + gitDirectory,
    },
    trackedFileCount: files.length,
    missingTrackedFiles: filesResult.missing,
    directoryCount: aggregateDirectories(files).length,
    largestFiles,
    largestDirectories,
    fileTypes,
    extensions,
    warnings,
    recommendations,
    ...(history ? { history } : {}),
  };
}

export function getLimitViolations(
  report: RepositoryReport,
  config: AnalysisConfig,
  files?: readonly TrackedFile[],
): readonly string[] {
  const violations: string[] = [];
  if (config.maxFileSize !== undefined) {
    const limit = config.maxFileSize;
    const candidates =
      files ??
      report.warnings.flatMap((warning) =>
        warning.path !== undefined && warning.size !== undefined
          ? [{ path: warning.path, size: warning.size, kind: 'file' as const }]
          : [],
      );
    const oversized = candidates
      .filter((file) => file.size > limit)
      .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
    for (const file of oversized) {
      violations.push(
        `file ${file.path} (${formatBytes(file.size)}) exceeds the maximum file size of ${formatBytes(limit)}`,
      );
    }
  }
  if (config.maxRepositorySize !== undefined && report.sizes.total > config.maxRepositorySize) {
    violations.push(
      `repository total (${formatBytes(report.sizes.total)}) exceeds the maximum repository size of ${formatBytes(config.maxRepositorySize)}`,
    );
  }
  return violations;
}

function createWarnings(files: readonly TrackedFile[], threshold: number): readonly Warning[] {
  return files
    .filter((file) => file.size > threshold)
    .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path))
    .map((file) => ({
      path: file.path,
      size: file.size,
      message: `${file.path} is ${formatBytes(file.size)}`,
    }));
}

function createRecommendations(
  files: readonly TrackedFile[],
  warnings: readonly Warning[],
  repository: RepositoryInfo,
): readonly string[] {
  const recommendations: string[] = [];
  if (files.length === 0) {
    recommendations.push(
      repository.hasCommits
        ? 'No tracked files were found in this repository.'
        : 'This repository has no commits or tracked files yet.',
    );
    return recommendations;
  }
  if (warnings.length > 0) {
    recommendations.push('Consider Git LFS for large binary assets that do not belong in regular Git objects.');
  }
  if (repository.hasCommits && files.some((file) => /\.(zip|tar|gz|7z|rar|mp4|mov|psd|bin|iso)$/i.test(file.path))) {
    recommendations.push('Review archived or generated assets and keep build artifacts out of source control when possible.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Repository size looks healthy; rerun with --history to inspect historical objects.');
  }
  return recommendations;
}

function matchesIgnore(path: string, patterns: readonly string[]): boolean {
  return matchesAnyGlob(path, patterns);
}