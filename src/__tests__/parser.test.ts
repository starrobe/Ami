import { describe, it, expect } from 'vitest';
import { parseCommand } from '../commands/parser';

describe('parseCommand', () => {
  it('parses simple command', () => {
    expect(parseCommand('ls')).toEqual({ cmd: 'ls', args: [], flags: [] });
  });

  it('parses short flags', () => {
    expect(parseCommand('ls -la')).toEqual({ cmd: 'ls', args: [], flags: ['l', 'a'] });
  });

  it('parses long flags', () => {
    expect(parseCommand('grep --help')).toEqual({ cmd: 'grep', args: [], flags: ['help'] });
  });

  it('parses args', () => {
    expect(parseCommand('cat file.md')).toEqual({ cmd: 'cat', args: ['file.md'], flags: [] });
  });

  it('returns null for empty input', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });

  it('handles quoted strings', () => {
    expect(parseCommand('echo "hello world"')).toEqual({ cmd: 'echo', args: ['hello world'], flags: [] });
  });

  it('handles escape sequences', () => {
    expect(parseCommand('echo "a\\tb"')).toEqual({ cmd: 'echo', args: ['a\tb'], flags: [] });
  });

  it('handles mixed flags and args', () => {
    expect(parseCommand('grep -i -n pattern file')).toEqual({ cmd: 'grep', args: ['pattern', 'file'], flags: ['i', 'n'] });
  });
});
