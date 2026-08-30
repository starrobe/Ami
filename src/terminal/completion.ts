import type { DirNode } from '../types';
import { resolvePath, getNode } from '../fs/filesystem';
import { commandNames, fileArgCommands, commandFlags } from '../commands/descriptions';
import { formatColumns } from '../utils/columnLayout';

export function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let common = strings[0];
  for (let i = 1; i < strings.length; i++) {
    let j = 0;
    while (j < common.length && j < strings[i].length && common[j] === strings[i][j]) {
      j++;
    }
    common = common.slice(0, j);
  }
  return common;
}

export function formatMatchList(matches: string[], selectedIndex: number, termCols: number): string {
  return formatColumns(matches, termCols, 9, 8, selectedIndex);
}

export interface CompletionCandidates {
  matches: string[];
  buildSuffix: ((m: string) => string) | null;
  /** The part being matched (last path segment, or the flag/command fragment). */
  matchPrefix: string;
  /** Character offset (from buffer start) where the partial token begins. */
  prefixStart: number;
  /** The full partial token being completed. */
  partial: string;
}

/**
 * Compute tab-completion candidates for the current input buffer.
 * Returns null when completion does not apply (e.g. a command that
 * takes no file arguments).
 */
export function computeCandidates(input: {
  buffer: string;
  cwd: string;
  fs: DirNode;
}): CompletionCandidates | null {
  const { buffer, cwd, fs } = input;

  const rawTokens = buffer.split(/\s+/);
  const tokens = rawTokens.filter((t) => t.length > 0);
  const trailingSpace = /\s$/.test(buffer);
  const isCommand = tokens.length === 0 || (tokens.length === 1 && !trailingSpace);
  const partial = trailingSpace ? '' : tokens.length > 0 ? tokens[tokens.length - 1] : '';
  const prefixStart = buffer.length - partial.length;

  let matches: string[] = [];
  let buildSuffix: ((m: string) => string) | null = null;
  let matchPrefix = '';

  if (isCommand) {
    matchPrefix = partial.toLowerCase();
    matches = commandNames.filter((c) => c.startsWith(matchPrefix));
    buildSuffix = (m: string) => m.slice(matchPrefix.length) + ' ';
  } else if (partial.startsWith('-')) {
    // Flag completion
    const cmd = tokens[0]?.toLowerCase();
    const flags = commandFlags[cmd] || [];
    matches = flags.filter((f) => f.startsWith(partial));
    matchPrefix = partial;
    buildSuffix = (m: string) => m.slice(matchPrefix.length) + ' ';
  } else {
    // Path completion
    const cmd = tokens[0]?.toLowerCase();
    if (cmd && !fileArgCommands.includes(cmd)) return null;
    try {
      const pathSegs = partial.split('/');
      matchPrefix = pathSegs[pathSegs.length - 1] || '';
      const dirPart = pathSegs.slice(0, -1).join('/');
      const resolvedDir = resolvePath(cwd, dirPart || '.');
      const dirNode = getNode(fs, resolvedDir);
      if (dirNode && dirNode.type === 'dir') {
        const children = Object.keys(dirNode.children);
        matches = children.filter((c) => c.startsWith(matchPrefix));
        const basePath = pathSegs.slice(0, -1).join('/');
        buildSuffix = (m: string) => {
          const entry = dirNode.children[m];
          const sfx = entry.type === 'dir' ? '/' : '';
          const fullMatch = (basePath ? basePath + '/' : '') + m + sfx;
          return fullMatch.slice(partial.length);
        };
      }
    } catch {
      /* ignore */
    }
  }

  return { matches, buildSuffix, matchPrefix, prefixStart, partial };
}
