import { describe, expect, it } from 'vitest';

import { aggregateFileTypes, classifyFile, extensionOf } from '../src/analysis/fileTypes.js';

describe('file classification', () => {
  it.each([
    ['app.js', 'JavaScript'],
    ['component.ts', 'TypeScript'],
    ['component.tsx', 'TypeScript'],
    ['package.json', 'JSON'],
    ['index.html', 'HTML'],
    ['styles.css', 'CSS'],
    ['image.png', 'Images'],
    ['photo.jpg', 'Images'],
    ['video.mp4', 'Video'],
    ['sound.mp3', 'Audio'],
    ['font.ttf', 'Fonts'],
    ['archive.zip', 'Archives'],
    ['guide.pdf', 'Documents'],
    ['module.bin', 'Binary'],
    ['README', 'Other'],
  ])('classifies %s', (path, category) => {
    expect(classifyFile(path)).toBe(category);
  });

  it('normalizes extensions and aggregates bytes', () => {
    expect(extensionOf('src/README')).toBe('(no extension)');
    expect(
      aggregateFileTypes([
        { path: 'a.js', size: 10, kind: 'file' },
        { path: 'b.js', size: 20, kind: 'file' },
        { path: 'c.png', size: 5, kind: 'file' },
      ]).fileTypes,
    ).toEqual([
      { category: 'JavaScript', size: 30, count: 2 },
      { category: 'Images', size: 5, count: 1 },
    ]);
  });
});