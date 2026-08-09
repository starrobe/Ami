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

  const cols = ctx.termCols || 80;
  const maxLen = Math.max(...entries.map(e => e.length));
  const colWidth = maxLen + 2; // 2 spaces between columns
  const numCols = Math.max(1, Math.floor(cols / colWidth));
  const numRows = Math.ceil(entries.length / numCols);

  let output = '';
  for (let row = 0; row < numRows; row++) {
    let line = '';
    for (let col = 0; col < numCols; col++) {
      const idx = col * numRows + row;
      if (idx < entries.length) {
        line += entries[idx].padEnd(colWidth);
      }
    }
    output += line.trimEnd() + '\r\n';
  }

  return { output };
};
