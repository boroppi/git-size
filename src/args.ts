import { parseArgs as nodeParseArgs } from 'node:util';

import type { CliOptions } from './types.js';
import { CliError } from './utils/errors.js';
import { parseSize } from './utils/sizes.js';

export function parseCliArgs(argv: readonly string[]): CliOptions {
  let parsed: ReturnType<typeof nodeParseArgs>;
  try {
    parsed = nodeParseArgs({
      args: [...argv],
      allowPositionals: false,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        history: { type: 'boolean' },
        json: { type: 'boolean' },
        ci: { type: 'boolean' },
        largest: { type: 'string' },
        'max-file-size': { type: 'string' },
        'max-repo-size': { type: 'string' },
        config: { type: 'string' },
      },
    });
  } catch (error) {
    throw new CliError(error instanceof Error ? error.message : 'Invalid command-line arguments.');
  }

  const values = parsed.values;
  const json = values.json === true;
  const ci = values.ci === true;
  if (json && ci) {
    throw new CliError('Choose either --json or --ci; they cannot be used together.');
  }

  return {
    help: values.help === true,
    version: values.version === true,
    history: values.history === true,
    json,
    ci,
    largest: values.largest === undefined ? undefined : parseLargest(readStringOption(values.largest, '--largest')),
    maxFileSize:
      values['max-file-size'] === undefined
        ? undefined
        : parseCliSize(
            readStringOption(values['max-file-size'], '--max-file-size'),
            '--max-file-size',
          ),
    maxRepositorySize:
      values['max-repo-size'] === undefined
        ? undefined
        : parseCliSize(
            readStringOption(values['max-repo-size'], '--max-repo-size'),
            '--max-repo-size',
          ),
    configPath:
      values.config === undefined ? undefined : requireString(readStringOption(values.config, '--config'), '--config'),
  };
}

export function helpText(): string {
  return `git-size — understand what's making your Git repository heavy

Usage:
  git-size [options]

Options:
  -h, --help                 Show this help message
  -v, --version              Show the installed version
      --largest <count>      Number of largest files/directories to show (default: 10)
      --history              Analyze Git objects and reachable history
      --json                 Print structured JSON for automation
      --ci                   Print concise CI output and enforce configured limits
      --max-file-size <size> Fail CI when a tracked file exceeds this size
      --max-repo-size <size> Fail CI when the repository total exceeds this size
      --config <path>        Read configuration from a specific JSON file

Examples:
  npx git-size
  git-size --largest 20
  git-size --history
  git-size --json
  git-size --ci --max-file-size 10MB
`;
}

function parseLargest(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CliError(`Invalid --largest value "${value}". Use a positive whole number.`);
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count <= 0 || count > 10000) {
    throw new CliError('--largest must be an integer between 1 and 10000.');
  }
  return count;
}

function parseCliSize(value: string, option: string): number {
  try {
    return parseSize(value);
  } catch (error) {
    throw new CliError(`${option}: ${error instanceof Error ? error.message : 'invalid size'}`);
  }
}

function requireString(value: string | boolean, option: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CliError(`${option} requires a non-empty value.`);
  }
  return value;
}

function readStringOption(value: string | boolean | (string | boolean)[], option: string): string {
  if (typeof value !== 'string') {
    throw new CliError(`${option} requires a single value.`);
  }
  return value;
}