import { describe, it, expect } from 'vitest';
import { computeCandidates, findCommonPrefix } from '../terminal/completion';
import { createInitialFS } from '../fs/filesystem';

const fs = createInitialFS();

describe('computeCandidates', () => {
  it('completes command names', () => {
    const r = computeCandidates({ buffer: 'c', cwd: '/home/user', fs });
    expect(r).not.toBeNull();
    expect(r!.matches).toContain('cat');
    expect(r!.matches).toContain('cd');
    expect(r!.partial).toBe('c');
  });

  it('completes paths under the cwd', () => {
    const r = computeCandidates({ buffer: 'cat b', cwd: '/home/user', fs });
    expect(r).not.toBeNull();
    expect(r!.matches).toEqual(['blog']);
    expect(r!.buildSuffix!('blog')).toBe('log/');
  });

  it('completes flags', () => {
    const r = computeCandidates({ buffer: 'ls -', cwd: '/home/user', fs });
    expect(r).not.toBeNull();
    expect(r!.matches).toEqual(['-l', '-a']);
  });

  it('returns null for non-file-arg commands', () => {
    expect(computeCandidates({ buffer: 'echo x', cwd: '/home/user', fs })).toBeNull();
  });
});

describe('findCommonPrefix', () => {
  it('finds the shared prefix', () => {
    expect(findCommonPrefix(['cat', 'cd'])).toBe('c');
    expect(findCommonPrefix(['foo', 'bar'])).toBe('');
    expect(findCommonPrefix([])).toBe('');
  });
});
