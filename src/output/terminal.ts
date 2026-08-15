import type { CliOptions, HistoryReport, RepositoryReport } from '../types.js';
import { formatBytes } from '../utils/sizes.js';

export function renderTerminal(report: RepositoryReport, options: CliOptions): string {
  if (options.ci) {
    return renderCi(report);
  }

  const color = shouldUseColor();
  const symbols = shouldUseSymbols();
  const warn = symbols ? '⚠' : '!';
  const tip = symbols ? '💡' : '>';
  const lines: string[] = [];
  const heading = (value: string) => lines.push(colorize(value, 'bold', color), '─'.repeat(46));

  lines.push(colorize('git-size', 'bold', color));
  lines.push(`Repository: ${report.repository.name}`);
  lines.push(`Path:       ${report.repository.path}`);
  lines.push(`Branch:     ${report.repository.branch}`, '');

  heading('Repository size');
  lines.push(
    ...table([
      ['Tracked files', formatBytes(report.sizes.workingTree)],
      ['Git directory', formatBytes(report.sizes.gitDirectory)],
      ['Total', formatBytes(report.sizes.total)],
    ]),
    '',
  );

  heading(`Largest tracked files (${report.trackedFileCount} files)`);
  lines.push(
    ...table(
      report.largestFiles.length > 0
        ? report.largestFiles.map((file) => [formatBytes(file.size), file.path])
        : [['—', 'No tracked files found']],
    ),
    '',
  );

  heading('Largest directories');
  lines.push(
    ...table(
      report.largestDirectories.length > 0
        ? report.largestDirectories.map((directory) => [formatBytes(directory.size), directory.path])
        : [['—', 'No tracked directories found']],
    ),
  );
  if (report.largestDirectories.length > 0) {
    lines.push('Directory sizes include nested tracked files.');
  }
  lines.push('');

  heading('File types');
  lines.push(...renderFileTypes(report), '');

  heading('Summary');
  lines.push(
    ...table([
      ['Tracked files', String(report.trackedFileCount)],
      ['Directories', String(report.directoryCount)],
      ['Largest file', report.largestFiles[0] ? formatBytes(report.largestFiles[0].size) : '—'],
    ]),
  );

  if (report.missingTrackedFiles.length > 0) {
    lines.push(
      '',
      colorize(
        `${warn} ${report.missingTrackedFiles.length} tracked file(s) are missing from disk.`,
        'yellow',
        color,
      ),
    );
  }
  if (report.warnings.length > 0) {
    lines.push(
      '',
      colorize(`${warn} ${report.warnings.length} file(s) exceed the recommended size threshold.`, 'yellow', color),
    );
    for (const warning of report.warnings.slice(0, 5)) {
      lines.push(`  ${formatBytes(warning.size ?? 0).padStart(8)}  ${warning.path ?? warning.message}`);
    }
  }
  for (const recommendation of report.recommendations) {
    lines.push('', colorize(`${tip} ${recommendation}`, 'cyan', color));
  }

  if (report.history) {
    lines.push('', ...renderHistory(report.history, color, tip));
  } else {
    lines.push('', colorize(`${tip} Run \`git-size --history\` to analyze Git history.`, 'cyan', color));
  }

  return `${lines.join('\n')}\n`;
}

function renderFileTypes(report: RepositoryReport): string[] {
  if (report.fileTypes.length === 0) {
    return table([['—', 'No tracked files found']]);
  }

  const categoryLines = table(
    report.fileTypes.map((stat) => [
      stat.category,
      formatBytes(stat.size),
      `${stat.count} ${stat.count === 1 ? 'file' : 'files'}`,
    ]),
  );
  const lines: string[] = [];
  for (const [index, stat] of report.fileTypes.entries()) {
    const line = categoryLines[index];
    if (line) {
      lines.push(line);
    }
    const extensions = report.extensions.filter((extension) => extension.category === stat.category);
    if (extensions.length > 1) {
      for (const extension of extensions.slice(0, 3)) {
        lines.push(
          `  ${extension.extension.padEnd(10)} ${formatBytes(extension.size).padStart(8)}   ${extension.count} ${extension.count === 1 ? 'file' : 'files'}`,
        );
      }
    }
  }
  return lines;
}

function renderCi(report: RepositoryReport): string {
  const lines = [
    `git-size: ${report.repository.name}`,
    `files=${report.trackedFileCount} tracked=${formatBytes(report.sizes.workingTree)} git=${formatBytes(report.sizes.gitDirectory)} total=${formatBytes(report.sizes.total)}`,
  ];
  if (report.warnings.length > 0) {
    lines.push(`warnings=${report.warnings.length}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderHistory(history: HistoryReport, color: boolean, tip: string): string[] {
  const lines = [colorize('Git history', 'bold', color), '─'.repeat(46)];
  lines.push(
    ...table([
      ['Git directory', formatBytes(history.gitDirectorySize)],
      ['Loose objects', `${formatBytes(history.looseObjectsSize)} (${history.looseObjects})`],
      ['Packed objects', `${formatBytes(history.packedObjectsSize)} (${history.packedObjects})`],
      ['Object count', String(history.objectCount)],
    ]),
    '',
    colorize('Largest historical objects', 'bold', color),
    '─'.repeat(46),
  );
  lines.push(
    ...table(
      history.largestObjects.length > 0
        ? history.largestObjects.map((object) => [
            formatBytes(object.size),
            object.path ?? `(object ${object.objectId.slice(0, 10)})`,
          ])
        : [['—', 'No reachable objects found']],
    ),
  );
  for (const note of history.notes) {
    lines.push('', colorize(`${tip} ${note}`, 'cyan', color));
  }
  return lines;
}

function shouldUseColor(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  return process.stdout.isTTY === true;
}

function shouldUseSymbols(): boolean {
  if (process.stdout.isTTY !== true) {
    return false;
  }
  if (process.platform !== 'win32') {
    return true;
  }
  return Boolean(process.env.WT_SESSION || process.env.TERM_PROGRAM);
}

function table(rows: readonly (readonly string[])[]): string[] {
  if (rows.length === 0) {
    return [];
  }
  const columnCount = Math.max(...rows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, index) =>
    Math.max(...rows.map((row) => row[index]?.length ?? 0)),
  );
  return rows.map((row) =>
    row
      .map((value, index) => (index === row.length - 1 ? value : value.padStart(widths[index] ?? value.length)))
      .join('   '),
  );
}

function colorize(value: string, color: 'bold' | 'yellow' | 'cyan', enabled: boolean): string {
  if (!enabled) {
    return value;
  }
  const codes = { bold: 1, yellow: 33, cyan: 36 };
  return `\u001b[${codes[color]}m${value}\u001b[0m`;
}