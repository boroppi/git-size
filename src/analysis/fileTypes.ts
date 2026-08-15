import type { FileCategory, ExtensionStat, FileTypeStat, TrackedFile } from '../types.js';

const categoryExtensions: Readonly<Record<FileCategory, readonly string[]>> = {
  JavaScript: ['.js', '.jsx', '.mjs', '.cjs'],
  TypeScript: ['.ts', '.tsx', '.mts', '.cts'],
  JSON: ['.json', '.jsonc', '.json5'],
  HTML: ['.html', '.htm', '.xhtml'],
  CSS: ['.css', '.scss', '.sass', '.less', '.styl'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.bmp', '.tif', '.tiff'],
  Video: ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.mpeg', '.mpg'],
  Audio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus', '.aiff'],
  Fonts: ['.ttf', '.otf', '.woff', '.woff2', '.eot'],
  Archives: ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.zst'],
  Documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.rtf'],
  Binary: ['.bin', '.dat', '.dll', '.dylib', '.exe', '.so', '.wasm', '.class', '.jar'],
  Other: [],
};

const extensionCategories = new Map<string, FileCategory>(
  Object.entries(categoryExtensions).flatMap(([category, extensions]) =>
    extensions.map((extension) => [extension, category as FileCategory]),
  ),
);

export function extensionOf(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  const dot = basename.lastIndexOf('.');
  if (dot <= 0) {
    return '(no extension)';
  }
  return basename.slice(dot).toLowerCase();
}

export function classifyFile(filePath: string): FileCategory {
  const extension = extensionOf(filePath);
  return extensionCategories.get(extension) ?? 'Other';
}

export function aggregateFileTypes(files: readonly TrackedFile[]): {
  readonly fileTypes: readonly FileTypeStat[];
  readonly extensions: readonly ExtensionStat[];
} {
  const byCategory = new Map<FileCategory, { size: number; count: number }>();
  const byExtension = new Map<
    string,
    { category: FileCategory; size: number; count: number }
  >();

  for (const file of files) {
    const category = classifyFile(file.path);
    const categoryStat = byCategory.get(category) ?? { size: 0, count: 0 };
    categoryStat.size += file.size;
    categoryStat.count += 1;
    byCategory.set(category, categoryStat);

    const extension = extensionOf(file.path);
    const extensionStat = byExtension.get(extension) ?? { category, size: 0, count: 0 };
    extensionStat.size += file.size;
    extensionStat.count += 1;
    byExtension.set(extension, extensionStat);
  }

  const fileTypes = [...byCategory.entries()]
    .map(([category, stat]) => ({ category, ...stat }))
    .sort((a, b) => b.size - a.size || a.category.localeCompare(b.category));
  const extensions = [...byExtension.entries()]
    .map(([extension, stat]) => ({ extension, ...stat }))
    .sort((a, b) => b.size - a.size || a.extension.localeCompare(b.extension));

  return { fileTypes, extensions };
}