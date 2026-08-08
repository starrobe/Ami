import type { DirNode, FSEntry } from '../types';
import aboutContent from './content/about.md?raw';
import helloWorldContent from './content/blog/hello-world.md?raw';
import amiTerminalContent from './content/projects/ami-terminal.md?raw';

export function createInitialFS(): DirNode {
  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          user: {
            type: 'dir',
            children: {
              'about.md': {
                type: 'file',
                content: aboutContent,
              },
              // Files with common prefix "photo-"
              'photo-1.jpg': {
                type: 'file',
                content: 'binary',
              },
              'photo-2.jpg': {
                type: 'file',
                content: 'binary',
              },
              'photo-3.jpg': {
                type: 'file',
                content: 'binary',
              },
              // Common prefix "read"
              'readme.txt': {
                type: 'file',
                content: 'Welcome to Ami!',
              },
              'receipt.pdf': {
                type: 'file',
                content: 'binary',
              },
              // Directories with common prefix "doc"
              'documents': {
                type: 'dir',
                children: {
                  'resume.pdf': { type: 'file', content: 'resume' },
                  'notes.txt': { type: 'file', content: 'notes' },
                },
              },
              'downloads': {
                type: 'dir',
                children: {
                  'setup.exe': { type: 'file', content: 'binary' },
                },
              },
              projects: {
                type: 'dir',
                children: {
                  'ami-terminal.md': {
                    type: 'file',
                    content: amiTerminalContent,
                  },
                  // Common prefix "ami-"
                  'ami-bot.md': {
                    type: 'file',
                    content: '---\ntitle: Ami Bot\n---\n# Ami Bot\n',
                  },
                  // Common prefix "tui-"
                  'tui-app.md': {
                    type: 'file',
                    content: '---\ntitle: TUI App\n---\n# TUI App\n',
                  },
                  'tui-game.md': {
                    type: 'file',
                    content: '---\ntitle: TUI Game\n---\n# TUI Game\n',
                  },
                },
              },
              blog: {
                type: 'dir',
                children: {
                  'hello-world.md': {
                    type: 'file',
                    content: helloWorldContent,
                  },
                  // Common prefix "hello-"
                  'hello-react.md': {
                    type: 'file',
                    content: '---\ntitle: Hello React\n---\n# Hello React\n',
                  },
                  'hello-vue.md': {
                    type: 'file',
                    content: '---\ntitle: Hello Vue\n---\n# Hello Vue\n',
                  },
                  // Common prefix "setup-"
                  'setup-guide.md': {
                    type: 'file',
                    content: '---\ntitle: Setup Guide\n---\n# Setup Guide\n',
                  },
                  'setup-tips.md': {
                    type: 'file',
                    content: '---\ntitle: Setup Tips\n---\n# Setup Tips\n',
                  },
                },
              },
            },
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
  return Object.keys(node.children).sort((a, b) => {
    const aIsDir = node.children[a].type === 'dir';
    const bIsDir = node.children[b].type === 'dir';
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });
}

export function isDirectory(fs: DirNode, path: string): boolean {
  const node = getNode(fs, path);
  return node !== null && node.type === 'dir';
}
