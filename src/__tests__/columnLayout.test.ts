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

  it('highlights the selected entry in single row', () => {
    const result = formatColumns(['a', 'bb', 'ccc'], 200, 8, 8, 1);
    expect(result).toBe('a  \x1b[7mbb\x1b[0m  ccc');
  });

  it('highlights the selected entry in multi-row layout', () => {
    const entries = ['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff', 'ggggggg', 'hhhhhhhh', 'iiiiiiiii'];
    const result = formatColumns(entries, 80, 8, 8, 4);
    // Cells are padded before the highlight so escape codes don't break alignment
    expect(result).toContain('\x1b[7m' + 'eeeee'.padEnd(11) + '\x1b[0m');
  });

  it('does not highlight when index is -1', () => {
    const result = formatColumns(['a', 'bb'], 200, 8, 8, -1);
    expect(result).toBe('a  bb');
  });
});
