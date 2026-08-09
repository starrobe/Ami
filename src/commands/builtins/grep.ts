import type { CommandHandler } from '../../types';
import { resolvePath, getNode } from '../../fs/filesystem';
import type { DirNode } from '../../types';

function parseTags(content: string): string[] {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];
  const fm = match[1];
  const tagLine = fm.split('\n').find(line => line.startsWith('tags:'));
  if (!tagLine) return [];
  return tagLine
    .replace(/^tags:\s*/, '')
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
}

export const grepCommand: CommandHandler = (ctx, parsed) => {
  // -t flag: search by tag in frontmatter
  if (parsed.flags.includes('t')) {
    if (parsed.args.length === 0) {
      return { output: 'grep: missing tag\r\n' };
    }
    const tag = parsed.args[0].toLowerCase();
    const target = parsed.args[1] || '.';
    const path = resolvePath(ctx.fs, ctx.cwd, target);
    const node = getNode(ctx.fs, path);

    if (!node) {
      return { output: `grep: ${target}: No such file or directory\r\n` };
    }

    const results: string[] = [];

    function searchDir(dir: DirNode, dirPath: string) {
      for (const [name, entry] of Object.entries(dir.children)) {
        const entryPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`;
        if (entry.type === 'file' && name.endsWith('.md')) {
          const tags = parseTags(entry.content);
          if (tags.includes(tag)) {
            results.push(entryPath);
          }
        } else if (entry.type === 'dir') {
          searchDir(entry, entryPath);
        }
      }
    }

    if (node.type === 'dir') {
      searchDir(node, path);
    } else if (node.type === 'file' && target.endsWith('.md')) {
      const tags = parseTags(node.content);
      if (tags.includes(tag)) {
        results.push(path);
      }
    }

    if (results.length === 0) return { output: '' };
    return { output: results.join('\r\n') + '\r\n' };
  }

  // Standard grep
  if (parsed.args.length === 0) {
    return { output: 'grep: missing pattern\r\n' };
  }
  if (parsed.args.length === 1) {
    return { output: 'grep: missing file or directory\r\n' };
  }

  const pattern = parsed.args[0];
  const target = parsed.args[1];
  const ignoreCase = parsed.flags.includes('i');
  const showLineNumbers = parsed.flags.includes('n');
  const recursive = parsed.flags.includes('r');

  const path = resolvePath(ctx.fs, ctx.cwd, target);
  const node = getNode(ctx.fs, path);

  if (!node) {
    return { output: `grep: ${target}: No such file or directory\r\n` };
  }

  const results: string[] = [];

  function searchFile(filePath: string, content: string) {
    const lines = content.split('\n');
    const flags = ignoreCase ? 'i' : '';
    let regex: RegExp;
    try {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch {
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        const prefix = showLineNumbers ? `${i + 1}:` : '';
        const fileLabel = recursive ? `${filePath}:` : '';
        results.push(`${fileLabel}${prefix}${lines[i]}`);
      }
    }
  }

  function searchDir(dir: DirNode, dirPath: string) {
    for (const [name, entry] of Object.entries(dir.children)) {
      const entryPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`;
      if (entry.type === 'file') {
        searchFile(entryPath, entry.content);
      } else if (entry.type === 'dir' && recursive) {
        searchDir(entry, entryPath);
      }
    }
  }

  if (node.type === 'file') {
    searchFile(path, node.content);
  } else if (node.type === 'dir') {
    if (!recursive) {
      return { output: `grep: ${target}: Is a directory\r\n` };
    }
    searchDir(node, path);
  }

  if (results.length === 0) {
    return { output: '' };
  }

  return { output: results.join('\r\n') + '\r\n' };
};
