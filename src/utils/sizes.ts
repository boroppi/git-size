const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error('Byte counts must be finite and non-negative.');
  }

  if (bytes === 0) {
    return '0 B';
  }

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const formatted = Number(value.toFixed(decimals)).toString();
  return `${formatted} ${UNITS[unitIndex]}`;
}

export function parseSize(input: string): number {
  const normalized = input.trim().toUpperCase();
  const match = /^(\d+(?:\.\d+)?)\s*(B|KB|KIB|MB|MIB|GB|GIB|TB|TIB)?$/.exec(
    normalized,
  );

  if (!match) {
    throw new Error(
      `Invalid size "${input}". Use a value such as 500KB, 10MB, or 1GB.`,
    );
  }

  const value = Number(match[1]);
  const unit = match[2] ?? 'B';
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 ** 2,
    MIB: 1024 ** 2,
    GB: 1024 ** 3,
    GIB: 1024 ** 3,
    TB: 1024 ** 4,
    TIB: 1024 ** 4,
  };
  const multiplier = multipliers[unit];
  if (multiplier === undefined) {
    throw new Error(`Unsupported size unit "${unit}".`);
  }
  const bytes = value * multiplier;

  if (!Number.isSafeInteger(Math.round(bytes)) || bytes <= 0) {
    throw new Error(`Size "${input}" must be greater than zero and fit in a safe integer.`);
  }

  return Math.round(bytes);
}