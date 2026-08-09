import type { CommandHandler } from '../../types';
import { resolvePath, getNode, listDir } from '../../fs/filesystem';

export const lsCommand: CommandHandler = (ctx, parsed) => {
  const target = parsed.args[0] || '.';
  const showHidden = parsed.flags.includes('a');
  const longFormat = parsed.flags.includes('l');
  const path = resolvePath(ctx.fs, ctx.cwd, target);
  const node = getNode(ctx.fs, path);

  if (!node) {
    return { output: `ls: cannot access '${target}': No such file or directory\r\n` };
  }

  if (node.type !== 'dir') {
    const name = target.split('/').pop() || target;
    return { output: name + '\r\n' };
  }

  let entries = listDir(ctx.fs, path);
  if (!showHidden) {
    entries = entries.filter(e => !e.startsWith('.'));
  }

  if (longFormat) {
    let output = '';
    for (const entry of entries) {
      const isDir = node.children[entry].type === 'dir';
      const prefix = isDir ? 'd' : '-';
      output += `${prefix}rwxr-xr-x  user  user    4096 Jan  1 12:00 ${entry}\r\n`;
    }
    return { output };
  }

  // Column layout to prevent splitting filenames
  if (entries.length === 0) return { output: '' };

  // Single row — equal spacing
  if (entries.length <= 6) {
    return { output: entries.join('  ') + '\r\n' };
  }

  const maxLen = Math.max(...entries.map(e => e.length));
  const colWidth = maxLen + 2; // 2 spaces between columns
  // Cap at 6 columns to keep output readable on wide screens
  const maxCols = Math.min(6, Math.floor((ctx.termCols || 80) / colWidth));
  const numCols = Math.max(1, Math.min(maxCols, entries.length));
  const numRows = Math.ceil(entries.length / numCols);

  let output = '';
  for (let row = 0; row < numRows; row++) {
    let line = '';
    for (let col = 0; col < numCols; col++) {
      const idx = col * numRows + row;
      if (idx < entries.length) {
        // Pad all columns except the last
        if (col < numCols - 1 && (col + 1) * numRows + row < entries.length) {
          line += entries[idx].padEnd(colWidth);
        } else {
          line += entries[idx];
        }
      }
    }
    output += line + '\r\n';
  }

  return { output };
};
