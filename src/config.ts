import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import type { CliOptions, GitSizeConfig } from './types.js';
import { CliError } from './utils/errors.js';
import { parseSize } from './utils/sizes.js';

export async function loadConfig(
  repositoryRoot: string,
  explicitPath?: string,
): Promise<GitSizeConfig> {
  const configPath = explicitPath
    ? isAbsolute(explicitPath)
      ? explicitPath
      : resolve(process.cwd(), explicitPath)
    : resolve(repositoryRoot, '.git-size.json');

  let contents: string;
  try {
    contents = await readFile(configPath, 'utf8');
  } catch (error) {
    if (!explicitPath && isMissingFileError(error)) {
      return {};
    }
    throw new CliError(`Could not read configuration file "${configPath}".`);
  }

  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch {
    throw new CliError(`Configuration file "${configPath}" contains invalid JSON.`);
  }

  return validateConfig(value, configPath);
}

export function mergeConfig(fileConfig: GitSizeConfig, cli: CliOptions): GitSizeConfig {
  return {
    maxFileSize: cli.maxFileSize ?? fileConfig.maxFileSize,
    maxRepositorySize: cli.maxRepositorySize ?? fileConfig.maxRepositorySize,
    largestFiles: cli.largest ?? fileConfig.largestFiles,
    ignore: fileConfig.ignore,
  };
}

function validateConfig(value: unknown, path: string): GitSizeConfig {
  if (!isRecord(value)) {
    throw new CliError(`Configuration file "${path}" must contain a JSON object.`);
  }

  const allowed = new Set(['maxFileSize', 'maxRepositorySize', 'largestFiles', 'ignore']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new CliError(`Configuration file "${path}" contains unknown option "${key}".`);
    }
  }

  return {
    maxFileSize: value.maxFileSize === undefined ? undefined : readSize(value.maxFileSize, 'maxFileSize', path),
    maxRepositorySize:
      value.maxRepositorySize === undefined
        ? undefined
        : readSize(value.maxRepositorySize, 'maxRepositorySize', path),
    largestFiles:
      value.largestFiles === undefined
        ? undefined
        : readPositiveInteger(value.largestFiles, 'largestFiles', path),
    ignore:
      value.ignore === undefined
        ? undefined
        : readStringArray(value.ignore, 'ignore', path),
  };
}

function readSize(value: unknown, option: string, path: string): number {
  try {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      return parseSize(value);
    }
  } catch {
    // Convert the lower-level parse error into a configuration-specific message.
  }
  throw new CliError(`Configuration option "${option}" in "${path}" must be a positive size.`);
}

function readPositiveInteger(value: unknown, option: string, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 10000) {
    throw new CliError(
      `Configuration option "${option}" in "${path}" must be an integer between 1 and 10000.`,
    );
  }
  return value;
}

function readStringArray(value: unknown, option: string, path: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new CliError(`Configuration option "${option}" in "${path}" must be an array of strings.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}