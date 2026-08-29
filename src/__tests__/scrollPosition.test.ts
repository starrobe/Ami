import { describe, it, expect } from 'vitest';
import { formatScrollPosition } from '../utils/scrollPosition';

describe('formatScrollPosition', () => {
  it('returns Top when content is not scrollable', () => {
    expect(formatScrollPosition(0, 200, 300)).toBe('Top');
  });

  it('returns Top at the top of scrollable content', () => {
    expect(formatScrollPosition(0, 1000, 300)).toBe('Top');
  });

  it('returns the rounded percentage mid-scroll', () => {
    // scrollTop 400 of max 700 → 57.14% → 57%
    expect(formatScrollPosition(400, 1000, 300)).toBe('57%');
  });

  it('returns Bot at the very bottom', () => {
    expect(formatScrollPosition(700, 1000, 300)).toBe('Bot');
  });

  it('returns Bot just before the very bottom', () => {
    expect(formatScrollPosition(699, 1000, 300)).toBe('Bot');
  });
});
