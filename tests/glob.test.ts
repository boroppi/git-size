import { describe, expect, it } from 'vitest';

import { matchesAnyGlob } from '../src/utils/glob.js';

describe('ignore globs', () => {
  it('matches simple and recursive patterns', () => {
    expect(matchesAnyGlob('coverage/lcov.info', ['coverage/**'])).toBe(true);
    expect(matchesAnyGlob('src/app.ts', ['coverage/**'])).toBe(false);
    expect(matchesAnyGlob('debug.log', ['*.log'])).toBe(true);
    expect(matchesAnyGlob('nested/debug.log', ['*.log'])).toBe(false);
  });
});
