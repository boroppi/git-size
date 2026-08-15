#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { analyzeRepository, getLimitViolations } from './analysis/files.js';
import { parseCliArgs, helpText } from './args.js';
import { loadConfig, mergeConfig } from './config.js';
import { detectRepository } from './git/repository.js';
import { renderJson } from './output/json.js';
import { renderTerminal } from './output/terminal.js';
import { CliError, errorMessage } from './utils/errors.js';
import { parseSize } from './utils/sizes.js';
import type { AnalysisConfig } from './types.js';

export interface CliIo {
  readonly cwd?: string;
  readonly stdout?: { write(chunk: string): void };
  readonly stderr?: { write(chunk: string): void };
}

export async function main(argv = process.argv.slice(2), io: CliIo = {}): Promise<number> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;

  try {
    return await run(argv, io.cwd ?? process.cwd(), stdout, stderr);
  } catch (error) {
    stderr.write(`git-size: ${errorMessage(error)}\n`);
    return error instanceof CliError ? error.exitCode : 1;
  }
}

async function run(
  argv: readonly string[],
  cwd: string,
  stdout: { write(chunk: string): void },
  stderr: { write(chunk: string): void },
): Promise<number> {
  const options = parseCliArgs(argv);
  if (options.help) {
    stdout.write(helpText());
    return 0;
  }
  if (options.version) {
    stdout.write(`${await readPackageVersion()}\n`);
    return 0;
  }

  const repository = await detectRepository(cwd);
  const fileConfig = await loadConfig(repository.path, options.configPath);
  const mergedConfig = mergeConfig(fileConfig, options);
  const defaultThreshold = parseSize('10MB');
  const config: AnalysisConfig = {
    largestFiles: mergedConfig.largestFiles ?? 10,
    warningThreshold: Math.min(mergedConfig.maxFileSize ?? defaultThreshold, defaultThreshold),
    maxFileSize: mergedConfig.maxFileSize,
    maxRepositorySize: mergedConfig.maxRepositorySize,
    ignore: mergedConfig.ignore ?? [],
  };
  const report = await analyzeRepository(repository, config, options.history);

  if (options.json) {
    stdout.write(`${renderJson(report)}\n`);
    return 0;
  }

  stdout.write(renderTerminal(report, options));
  if (options.ci) {
    const violations = getLimitViolations(report, config);
    if (violations.length > 0) {
      stderr.write(`git-size: ${violations.join('; ')}.\n`);
      return 1;
    }
  }
  return 0;
}

async function readPackageVersion(): Promise<string> {
  const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
  const packageContents = await readFile(packagePath, 'utf8');
  const packageJson = JSON.parse(packageContents) as { version?: unknown };
  if (typeof packageJson.version !== 'string') {
    throw new CliError('Could not determine the package version.');
  }
  return packageJson.version;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}