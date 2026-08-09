import type { DirNode, FSEntry } from '../types';

// Auto-discover all files under content/
const rawTextModules = {
  ...(import.meta.glob('./content/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('./content/**/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
};
// All other files — get their URL (works for images, PDFs, etc.)
const urlModules = import.meta.glob('./content/**/*', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

function getFileContent(filePath: string): string {
  if (rawTextModules[filePath]) return rawTextModules[filePath];
  // Return the URL for binary / unknown types
  return urlModules[filePath] || '[binary]';
}

function buildContentTree(): Record<string, FSEntry> {
  const root: Record<string, FSEntry> = {};

  for (const filePath of Object.keys(urlModules)) {
    const relative = filePath.replace('./content/', '');
    if (!relative) continue;
    const content = getFileContent(filePath);
    const segments = relative.split('/');
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i === segments.length - 1) {
        current[seg] = { type: 'file', content };
      } else {
        if (!current[seg]) {
          current[seg] = { type: 'dir', children: {} };
        }
        current = (current[seg] as DirNode).children;
      }
    }
  }

  return root;
}

export function createInitialFS(): DirNode {
  const contentRoot = buildContentTree();

  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          user: {
            type: 'dir',
            children: contentRoot,
          },
        },
      },
      bin: {
        type: 'dir',
        children: {},
      },
    },
  };
}

export function resolvePath(_fs: DirNode, cwd: string, target: string): string {
  // _fs kept for API consistency with getNode/listDir; resolution is purely
  // path-string based and does not need to inspect the tree.
  if (!target || target === '') return cwd;

  if (target === '~') return '/home/user';
  if (target === '/') return '/';

  // Absolute path
  if (target.startsWith('/')) return normalizePath(target);

  // Relative path
  const base = cwd === '/' ? '' : cwd;
  const combined = base + '/' + target;
  return normalizePath(combined);
}

function normalizePath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const result: string[] = [];

  for (const seg of segments) {
    if (seg === '..') {
      result.pop();
    } else if (seg !== '.') {
      result.push(seg);
    }
  }

  return '/' + result.join('/');
}

export function getNode(fs: DirNode, path: string): FSEntry | null {
  if (path === '/') return fs;

  const segments = path.split('/').filter(Boolean);
  let current: DirNode = fs;

  for (let i = 0; i < segments.length; i++) {
    const child = current.children[segments[i]];
    if (!child) return null;

    if (i === segments.length - 1) {
      return child;
    }

    if (child.type !== 'dir') return null;
    current = child;
  }

  return null;
}

export function getParentPath(path: string): string {
  if (path === '/') return '/';
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  return '/' + segments.join('/') || '/';
}

export function listDir(fs: DirNode, path: string): string[] {
  const node = getNode(fs, path);
  if (!node || node.type !== 'dir') return [];
  return Object.keys(node.children).sort((a, b) => a.localeCompare(b));
}

export function isDirectory(fs: DirNode, path: string): boolean {
  const node = getNode(fs, path);
  return node !== null && node.type === 'dir';
}
