import { describe, it, expect } from 'vitest';
import { formatColumns } from '../utils/columnLayout';

describe('formatColumns', () => {
  it('single row uses equal spacing', () => {
    const result = formatColumns(['a', 'bb', 'ccc'], 200);
    expect(result).toBe('a  bb  ccc');
  });

  it('multi-row uses column alignment', () => {
    const entries = ['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff', 'ggggggg', 'hhhhhhhh', 'iiiiiiiii'];
    const result = formatColumns(entries, 80, 8, 8);
    expect(result).toContain('a');
    expect(result).toContain('bb');
    expect(result).toContain('\r\n');
  });

  it('empty returns empty', () => {
    expect(formatColumns([], 200)).toBe('');
  });
});
