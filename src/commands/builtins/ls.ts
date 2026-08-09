import type { CommandHandler } from '../../types';
import { resolvePath, getNode, listDir } from '../../fs/filesystem';
import { profile } from '../../config';
import { formatColumns } from '../../utils/columnLayout';

function formatDate(content: string): string {
  const match = content.match(/^---\n[\s\S]*?date:\s*(\S+)[\s\n]/);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    return match[1];
  }
  return 'Jan  1  2024';
}

function formatSize(content: string): string {
  const len = content.length;
  if (len < 1024) return String(len).padStart(6);
  if (len < 1024 * 1024) return (len / 1024).toFixed(1).padStart(5) + 'K';
  return (len / (1024 * 1024)).toFixed(1).padStart(5) + 'M';
}

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
    const owner = (profile.find(p => p.key === 'Name')?.value) || 'user';
    let output = '';
    for (const entry of entries) {
      const child = node.children[entry];
      const isDir = child.type === 'dir';
      const prefix = isDir ? 'd' : '-';
      const perms = isDir ? 'rwxr-xr-x' : 'rw-r--r--';
      const size = isDir ? '4096'.padStart(6) : formatSize(child.content);
      const date = child.type === 'file' ? formatDate(child.content) : 'Jan  1  2024';
      output += `${prefix}${perms}  ${owner}  ${owner}  ${size}  ${date}  ${entry}\r\n`;
    }
    return { output };
  }

  return { output: formatColumns(entries, ctx.termCols || 80) + '\r\n' };
};
