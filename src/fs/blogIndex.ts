import type { DirNode } from '../types';
import { getNode } from './filesystem';

export interface BlogInfo {
  path: string;
  title: string;
  tags: string[];
  content: string;
}

export function parseFrontmatter(content: string): { title?: string; tags: string[] } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: undefined, tags: [] };
  const fm = match[1];

  const titleLine = fm.split('\n').find((l) => l.startsWith('title:'));
  const title = titleLine ? titleLine.replace(/^title:\s*/, '').trim() : undefined;

  const tagLine = fm.split('\n').find((l) => l.startsWith('tags:'));
  const tags = tagLine
    ? tagLine.replace(/^tags:\s*/, '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  return { title, tags };
}

export function listBlogs(fs: DirNode): BlogInfo[] {
  const blogDir = getNode(fs, '/home/user/blog');
  if (!blogDir || blogDir.type !== 'dir') return [];

  const results: BlogInfo[] = [];
  const walk = (dir: DirNode, dirPath: string) => {
    for (const [name, entry] of Object.entries(dir.children)) {
      const entryPath = `${dirPath}/${name}`;
      if (entry.type === 'file' && name.endsWith('.md')) {
        const { title, tags } = parseFrontmatter(entry.content);
        results.push({
          path: entryPath,
          title: title ?? name.replace(/\.md$/, ''),
          tags,
          content: entry.content,
        });
      } else if (entry.type === 'dir') {
        walk(entry, entryPath);
      }
    }
  };
  walk(blogDir, '/home/user/blog');
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

export function listTags(blogs: BlogInfo[]): string[] {
  const set = new Set<string>();
  for (const b of blogs) for (const t of b.tags) set.add(t);
  return [...set].sort();
}

export function searchBlogs(blogs: BlogInfo[], query: string): BlogInfo[] {
  const q = query.toLowerCase();
  if (q.length === 0) return blogs;
  return blogs.filter(
    (b) => b.title.toLowerCase().includes(q) || b.content.toLowerCase().includes(q)
  );
}
