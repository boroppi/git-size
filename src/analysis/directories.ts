import type { DirectoryStat, TrackedFile } from '../types.js';

export function aggregateDirectories(files: readonly TrackedFile[]): readonly DirectoryStat[] {
  const directories = new Map<string, number>();

  for (const file of files) {
    const parts = file.path.split('/');
    parts.pop();

    for (let index = 1; index <= parts.length; index += 1) {
      const directory = `${parts.slice(0, index).join('/')}/`;
      directories.set(directory, (directories.get(directory) ?? 0) + file.size);
    }
  }

  return [...directories.entries()]
    .map(([path, size]) => ({ path, size }))
    .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
}