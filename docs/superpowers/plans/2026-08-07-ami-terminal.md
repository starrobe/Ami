# Ami — Linux Terminal Personal Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal website styled as a Linux virtual terminal where users type commands to navigate blog posts and projects.

**Architecture:** xterm.js handles terminal input/display, a React state tree acts as the virtual filesystem, a command parser routes input to command handlers, and React components render rich Markdown content inline within the terminal.

**Tech Stack:** React 18 + TypeScript, Vite, xterm.js, react-markdown, @xterm/addon-fit, @xterm/addon-web-links

## Global Constraints

- React 18 + TypeScript via Vite
- Pure terminal aesthetic — no navigation bars, no modern UI chrome
- xterm.js for terminal emulation, react-markdown for rich content
- All content in-memory via virtual filesystem tree
- Font: JetBrains Mono / Fira Code, 15px
- Themes: matrix (default), amber, nord, solarized-dark, dracula

---

### Task 1: Project Scaffolding

**Files:**
- Create: entire Vite project scaffold

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd /home/adon/Ami
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Install terminal dependencies**

```bash
npm install xterm @xterm/addon-fit @xterm/addon-web-links react-markdown remark-frontmatter
npm install -D @types/node
```

- [ ] **Step 3: Clean up Vite defaults**

Delete `src/App.css`, `src/index.css`, `src/assets/react.svg`. Clear `src/App.tsx` to a minimal placeholder:
```tsx
export default function App() {
  return <div>Terminal loading...</div>;
}
```

- [ ] **Step 4: Run dev server, confirm page loads**

```bash
npm run dev
```
Expected: blank page with "Terminal loading..."

- [ ] **Step 5: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold Vite + React + TypeScript with xterm.js deps"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`

**Produces:**
- `FileType`, `FileNode`, `DirNode`, `FSEntry` — virtual filesystem types
- `ParsedCommand` — { cmd, args, flags }
- `CommandContext` — { cwd, fs, setCwd, appendOutput, setRichContent, theme, setTheme }
- `CommandResult` — { output?: string, richContent?: React.ReactNode }
- `CommandHandler` — (ctx: CommandContext, parsed: ParsedCommand) => CommandResult | void

- [ ] **Step 1: Write types file**

Create `src/types.ts`:

```ts
import type { ReactNode } from 'react';

export type FileType = 'file' | 'dir';

export interface FileNode {
  type: 'file';
  content: string;
  metadata?: Record<string, string>;
}

export interface DirNode {
  type: 'dir';
  children: Record<string, FSEntry>;
}

export type FSEntry = FileNode | DirNode;

export interface ParsedCommand {
  cmd: string;
  args: string[];
  flags: string[];
}

export interface CommandContext {
  cwd: string;
  fs: DirNode;
  setCwd: (path: string) => void;
  appendOutput: (text: string) => void;
  setRichContent: (node: ReactNode | null) => void;
  theme: string;
  setTheme: (name: string) => void;
}

export type CommandResult = {
  output?: string;
  richContent?: ReactNode;
};

export type CommandHandler = (
  ctx: CommandContext,
  parsed: ParsedCommand
) => CommandResult | void;

export interface Theme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add core types"
```

---

### Task 3: Virtual File System

**Files:**
- Create: `src/fs/filesystem.ts`
- Create: `src/fs/content/about.md`
- Create: `src/fs/content/blog/hello-world.md`
- Create: `src/fs/content/projects/ami-terminal.md`

**Consumes:** Types from Task 2
**Produces:**
- `createInitialFS(): DirNode` — builds the full FS tree
- `resolvePath(fs: DirNode, cwd: string, target: string): string` — resolves relative/absolute paths
- `getNode(fs: DirNode, path: string): FSEntry | null` — get node at path
- `getParentPath(path: string): string` — dirname

- [ ] **Step 1: Write filesystem module**

Create `src/fs/filesystem.ts`:

```ts
import type { DirNode, FSEntry } from '../types';

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
                content: `---
title: About Me
date: 2024-01-01
tags: personal
description: A bit about me
---

# About Me

Hello! I'm a developer passionate about building things for the web.

## Skills

- **Frontend:** React, TypeScript, CSS
- **Backend:** Node.js, Python
- **Tools:** Git, Docker, Linux

## Contact

- GitHub: [github.com/ami](https://github.com)
- Email: ami@example.com
`,
              },
              projects: {
                type: 'dir',
                children: {
                  'ami-terminal.md': {
                    type: 'file',
                    content: `---
title: Ami Terminal
date: 2026-08-01
tags: react, typescript, terminal
description: A personal website that looks like a Linux terminal
---

# Ami Terminal

A personal website styled as a Linux virtual terminal.

## Features

- Real terminal emulation with **xterm.js**
- Virtual filesystem navigation
- Markdown rendering for blog posts
- Multiple color themes
- Command history and autocomplete

## Tech Stack

- React + TypeScript
- xterm.js
- Vite
`,
                  },
                },
              },
              blog: {
                type: 'dir',
                children: {
                  'hello-world.md': {
                    type: 'file',
                    content: `---
title: Hello World
date: 2024-06-15
tags: meta, first-post
description: Welcome to my terminal blog
---

# Hello World

Welcome to my blog! This is the first post on my terminal-based personal site.

## Why a Terminal?

I've always loved the command line. It's fast, precise, and powerful. What better way to express myself than through the interface I use every day?

## What to Expect

I'll be writing about:

- Web development tips and tricks
- Open source projects I'm working on
- Linux and terminal workflows
- Random tech thoughts

Stay tuned for more!
`,
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

export function resolvePath(fs: DirNode, cwd: string, target: string): string {
  if (!target || target === '') return cwd;

  if (target === '~') return '/home/user';
  if (target === '-') return '/home/user'; // previous dir handled in cd command
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
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add virtual filesystem with sample content"
```

---

### Task 4: Command Parser

**Files:**
- Create: `src/commands/parser.ts`

**Consumes:** `ParsedCommand` from Task 2
**Produces:**
- `parseCommand(input: string): ParsedCommand` — splits "ls -la /home" → { cmd: "ls", args: ["/home"], flags: ["l", "a"] }

- [ ] **Step 1: Write parser**

Create `src/commands/parser.ts`:

```ts
import type { ParsedCommand } from '../types';

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;

  const cmd = tokens[0].toLowerCase();
  const flags: string[] = [];
  const args: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-') && token.length > 1 && !token.startsWith('--')) {
      // -la → ['l', 'a']
      for (const ch of token.slice(1)) {
        flags.push(ch);
      }
    } else {
      args.push(token);
    }
  }

  return { cmd, args, flags };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && input[i] === ' ') i++;
    if (i >= input.length) break;

    // Quoted string
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      i++;
      let token = '';
      while (i < input.length && input[i] !== quote) {
        token += input[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && input[i] !== ' ') {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add shell-style command parser"
```

---

### Task 5: Command Registry

**Files:**
- Create: `src/commands/registry.ts`

**Consumes:** `CommandHandler` from Task 2
**Produces:**
- `createRegistry(): { commands: Map<string, CommandHandler>, register, execute }`

- [ ] **Step 1: Write registry**

Create `src/commands/registry.ts`:

```ts
import type { CommandContext, ParsedCommand, CommandHandler } from '../types';

export interface CommandRegistry {
  register: (name: string, handler: CommandHandler) => void;
  execute: (ctx: CommandContext, parsed: ParsedCommand) => string | null;
  getNames: () => string[];
}

export function createRegistry(): CommandRegistry {
  const commands = new Map<string, CommandHandler>();

  return {
    register(name: string, handler: CommandHandler) {
      commands.set(name, handler);
    },

    execute(ctx: CommandContext, parsed: ParsedCommand): string | null {
      const handler = commands.get(parsed.cmd);
      if (!handler) {
        return `bash: ${parsed.cmd}: command not found`;
      }
      try {
        const result = handler(ctx, parsed);
        if (result?.output) return result.output;
        return null;
      } catch (err) {
        return `bash: ${parsed.cmd}: ${err instanceof Error ? err.message : 'error'}`;
      }
    },

    getNames() {
      return Array.from(commands.keys()).sort();
    },
  };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add command registry"
```

---

### Task 6: Simple Commands (help, echo, clear, pwd, whoami, history)

**Files:**
- Create: `src/commands/builtins/help.ts`
- Create: `src/commands/builtins/echo.ts`
- Create: `src/commands/builtins/clear.ts`
- Create: `src/commands/builtins/pwd.ts`
- Create: `src/commands/builtins/whoami.ts`
- Create: `src/commands/builtins/history.ts`

**Consumes:** `CommandHandler` from Task 2, registry from Task 5

- [ ] **Step 1: Write help command**

Create `src/commands/builtins/help.ts`:

```ts
import type { CommandHandler } from '../../types';
import type { CommandRegistry } from '../registry';

export function createHelpCommand(registry: CommandRegistry): CommandHandler {
  return (_ctx) => {
    const names = registry.getNames();
    const descriptions: Record<string, string> = {
      ls: 'list directory contents',
      cd: 'change the working directory',
      cat: 'concatenate and print files',
      grep: 'search for patterns in files',
      clear: 'clear the terminal screen',
      help: 'display this help message',
      pwd: 'print working directory',
      whoami: 'display current user',
      echo: 'display a line of text',
      theme: 'change terminal color theme',
      history: 'display command history',
    };

    let output = '\r\nAvailable commands:\r\n\r\n';
    for (const name of names) {
      const desc = descriptions[name] || '';
      output += `  ${name.padEnd(12)} ${desc}\r\n`;
    }
    output += '\r\n';
    return { output };
  };
}
```

- [ ] **Step 2: Write echo command**

Create `src/commands/builtins/echo.ts`:

```ts
import type { CommandHandler } from '../../types';

export const echoCommand: CommandHandler = (_ctx, parsed) => {
  return { output: parsed.args.join(' ') + '\r\n' };
};
```

- [ ] **Step 3: Write clear command**

Create `src/commands/builtins/clear.ts`:

```ts
import type { CommandHandler } from '../../types';

export const clearCommand: CommandHandler = (_ctx, _parsed) => {
  // Handled specially in terminal — sends ANSI clear sequence
  return { output: '\x1b[2J\x1b[H' };
};
```

- [ ] **Step 4: Write pwd command**

Create `src/commands/builtins/pwd.ts`:

```ts
import type { CommandHandler } from '../../types';

export const pwdCommand: CommandHandler = (ctx, _parsed) => {
  const displayPath = ctx.cwd.replace('/home/user', '~');
  return { output: displayPath + '\r\n' };
};
```

- [ ] **Step 5: Write whoami command**

Create `src/commands/builtins/whoami.ts`:

```ts
import type { CommandHandler } from '../../types';

export const whoamiCommand: CommandHandler = (_ctx, _parsed) => {
  return { output: 'user\r\n' };
};
```

- [ ] **Step 6: Write history command**

Create `src/commands/builtins/history.ts`:

```ts
import type { CommandHandler } from '../../types';

export function createHistoryCommand(
  getHistory: () => string[]
): CommandHandler {
  return (_ctx, _parsed) => {
    const history = getHistory();
    let output = '\r\n';
    history.forEach((entry, i) => {
      output += `  ${String(i + 1).padStart(4)}  ${entry}\r\n`;
    });
    output += '\r\n';
    return { output };
  };
}
```

- [ ] **Step 7: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add simple builtin commands"
```

---

### Task 7: Filesystem Commands (ls, cd)

**Files:**
- Create: `src/commands/builtins/ls.ts`
- Create: `src/commands/builtins/cd.ts`

**Consumes:** FileNode, DirNode types from Task 2, fs utils from Task 3

- [ ] **Step 1: Write ls command**

Create `src/commands/builtins/ls.ts`:

```ts
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
    // It's a file — just print its name
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

  return { output: entries.join('  ') + '\r\n' };
};
```

- [ ] **Step 2: Write cd command**

Create `src/commands/builtins/cd.ts`:

```ts
import type { CommandHandler } from '../../types';
import { resolvePath, getNode, isDirectory } from '../../fs/filesystem';

export function createCdCommand(
  getPrevCwd: () => string,
  setPrevCwd: (p: string) => void
): CommandHandler {
  return (ctx, parsed) => {
    let target = parsed.args[0];

    if (!target || target === '~') {
      target = '~';
    }

    if (target === '-') {
      const prev = getPrevCwd();
      const prevDisplay = prev.replace('/home/user', '~');
      setPrevCwd(ctx.cwd);
      ctx.setCwd(prev);
      return { output: prevDisplay + '\r\n' };
    }

    const path = resolvePath(ctx.fs, ctx.cwd, target);

    if (!getNode(ctx.fs, path)) {
      return { output: `cd: ${target}: No such file or directory\r\n` };
    }

    if (!isDirectory(ctx.fs, path)) {
      return { output: `cd: ${target}: Not a directory\r\n` };
    }

    setPrevCwd(ctx.cwd);
    ctx.setCwd(path);
    return { output: '' };
  };
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add ls and cd commands"
```

---

### Task 8: grep Command

**Files:**
- Create: `src/commands/builtins/grep.ts`

**Consumes:** FS utils from Task 3

- [ ] **Step 1: Write grep command**

Create `src/commands/builtins/grep.ts`:

```ts
import type { CommandHandler } from '../../types';
import { resolvePath, getNode } from '../../fs/filesystem';
import type { DirNode } from '../../types';

export const grepCommand: CommandHandler = (ctx, parsed) => {
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
    const flags = ignoreCase ? 'gi' : 'g';
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
    searchFile(target, node.content);
  } else if (node.type === 'dir') {
    searchDir(node, path);
  }

  if (results.length === 0) {
    return { output: '' };
  }

  return { output: results.join('\r\n') + '\r\n' };
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add grep command"
```

---

### Task 9: cat Command with Markdown Support

**Files:**
- Create: `src/commands/builtins/cat.ts`

**Consumes:** FS utils from Task 3, `CommandResult` with richContent from Task 2

- [ ] **Step 1: Write cat command**

Create `src/commands/builtins/cat.ts`:

```ts
import React from 'react';
import type { CommandHandler } from '../../types';
import { resolvePath, getNode } from '../../fs/filesystem';
import MarkdownView from '../../output/MarkdownView';

export const catCommand: CommandHandler = (ctx, parsed) => {
  if (parsed.args.length === 0) {
    return { output: 'cat: missing file operand\r\n' };
  }

  const target = parsed.args[0];
  const path = resolvePath(ctx.fs, ctx.cwd, target);
  const node = getNode(ctx.fs, path);

  if (!node) {
    return { output: `cat: ${target}: No such file or directory\r\n` };
  }

  if (node.type === 'dir') {
    return { output: `cat: ${target}: Is a directory\r\n` };
  }

  // .md files → rich React rendering
  if (target.endsWith('.md')) {
    // Parse frontmatter
    const content = node.content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const body = frontmatterMatch ? frontmatterMatch[2] : content;

    ctx.setRichContent(
      React.createElement(MarkdownView, { content: body })
    );
    return { output: '' };
  }

  // Plain files → terminal text
  return { output: node.content };
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add cat command with Markdown rendering"
```

---

### Task 10: MarkdownView Component

**Files:**
- Create: `src/output/MarkdownView.tsx`
- Create: `src/output/MarkdownView.css`

- [ ] **Step 1: Write MarkdownView component**

Create `src/output/MarkdownView.tsx`:

```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import './MarkdownView.css';

interface Props {
  content: string;
}

export default function MarkdownView({ content }: Props) {
  return (
    <div className="markdown-view">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          p: ({ children }) => <p className="md-p">{children}</p>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          code: ({ className, children }) => {
            const isInline = !className;
            return isInline ? (
              <code className="md-code-inline">{children}</code>
            ) : (
              <pre className="md-code-block"><code>{children}</code></pre>
            );
          },
          a: ({ href, children }) => (
            <a className="md-link" href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="md-strong">{children}</strong>,
          em: ({ children }) => <em className="md-em">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="md-blockquote">{children}</blockquote>
          ),
          hr: () => <hr className="md-hr" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Write styles**

Create `src/output/MarkdownView.css`:

```css
.markdown-view {
  padding: 8px 0 16px 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  line-height: 1.7;
  color: #c9d1d9;
  max-width: 100%;
}

.markdown-view .md-h1 {
  color: #00FF41;
  font-size: 1.4em;
  margin: 0 0 16px 0;
  border-bottom: 1px solid #30363D;
  padding-bottom: 8px;
}

.markdown-view .md-h2 {
  color: #00FF41;
  font-size: 1.15em;
  margin: 20px 0 10px 0;
}

.markdown-view .md-h3 {
  color: #00CC33;
  font-size: 1.05em;
  margin: 16px 0 8px 0;
}

.markdown-view .md-p {
  margin: 0 0 12px 0;
}

.markdown-view .md-ul, .markdown-view .md-ol {
  margin: 0 0 12px 0;
  padding-left: 24px;
}

.markdown-view .md-li {
  margin: 4px 0;
}

.markdown-view .md-code-inline {
  background: #161B22;
  color: #FFB000;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

.markdown-view .md-code-block {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 8px 0 16px 0;
}

.markdown-view .md-code-block code {
  color: #c9d1d9;
}

.markdown-view .md-link {
  color: #58A6FF;
  text-decoration: underline;
}

.markdown-view .md-strong {
  color: #00FF41;
  font-weight: 700;
}

.markdown-view .md-em {
  color: #FFB000;
  font-style: italic;
}

.markdown-view .md-blockquote {
  border-left: 3px solid #00FF41;
  padding-left: 16px;
  margin: 8px 0 16px 0;
  color: #8B949E;
}

.markdown-view .md-hr {
  border: none;
  border-top: 1px solid #30363D;
  margin: 20px 0;
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add MarkdownView component with terminal-inspired styles"
```

---

### Task 11: Theme System

**Files:**
- Create: `src/themes/themes.ts`

**Consumes:** `Theme` type from Task 2

- [ ] **Step 1: Write themes**

Create `src/themes/themes.ts`:

```ts
import type { Theme } from '../types';

export const themes: Record<string, Theme> = {
  matrix: {
    background: '#0D1117',
    foreground: '#00FF41',
    cursor: '#00FF41',
    selection: 'rgba(0, 255, 65, 0.3)',
    black: '#0D1117',
    red: '#FF6B6B',
    green: '#00FF41',
    yellow: '#FFD700',
    blue: '#58A6FF',
    magenta: '#BC8CFF',
    cyan: '#00D4AA',
    white: '#C9D1D9',
    brightBlack: '#484F58',
    brightRed: '#FF6B6B',
    brightGreen: '#00FF41',
    brightYellow: '#FFD700',
    brightBlue: '#58A6FF',
    brightMagenta: '#BC8CFF',
    brightCyan: '#00D4AA',
    brightWhite: '#F0F6FC',
  },
  amber: {
    background: '#0D1117',
    foreground: '#FFB000',
    cursor: '#FFB000',
    selection: 'rgba(255, 176, 0, 0.3)',
    black: '#0D1117',
    red: '#FF6B6B',
    green: '#FFB000',
    yellow: '#FFD700',
    blue: '#58A6FF',
    magenta: '#BC8CFF',
    cyan: '#00D4AA',
    white: '#C9D1D9',
    brightBlack: '#484F58',
    brightRed: '#FF6B6B',
    brightGreen: '#FFB000',
    brightYellow: '#FFD700',
    brightBlue: '#58A6FF',
    brightMagenta: '#BC8CFF',
    brightCyan: '#00D4AA',
    brightWhite: '#F0F6FC',
  },
  nord: {
    background: '#2E3440',
    foreground: '#D8DEE9',
    cursor: '#88C0D3',
    selection: 'rgba(136, 192, 208, 0.3)',
    black: '#3B4252',
    red: '#BF616A',
    green: '#A3BE8C',
    yellow: '#EBCB8B',
    blue: '#81A1C1',
    magenta: '#B48EAD',
    cyan: '#88C0D0',
    white: '#E5E9F0',
    brightBlack: '#4C566A',
    brightRed: '#BF616A',
    brightGreen: '#A3BE8C',
    brightYellow: '#EBCB8B',
    brightBlue: '#81A1C1',
    brightMagenta: '#B48EAD',
    brightCyan: '#8FBCBB',
    brightWhite: '#ECEFF4',
  },
  'solarized-dark': {
    background: '#002B36',
    foreground: '#839496',
    cursor: '#B58900',
    selection: 'rgba(181, 137, 0, 0.3)',
    black: '#073642',
    red: '#DC322F',
    green: '#859900',
    yellow: '#B58900',
    blue: '#268BD2',
    magenta: '#D33682',
    cyan: '#2AA198',
    white: '#EEE8D5',
    brightBlack: '#002B36',
    brightRed: '#CB4B16',
    brightGreen: '#586E75',
    brightYellow: '#657B83',
    brightBlue: '#839496',
    brightMagenta: '#6C71C4',
    brightCyan: '#93A1A1',
    brightWhite: '#FDF6E3',
  },
  dracula: {
    background: '#282A36',
    foreground: '#F8F8F2',
    cursor: '#BD93F9',
    selection: 'rgba(189, 147, 249, 0.3)',
    black: '#21222C',
    red: '#FF5555',
    green: '#50FA7B',
    yellow: '#F1FA8C',
    blue: '#BD93F9',
    magenta: '#FF79C6',
    cyan: '#8BE9FD',
    white: '#F8F8F2',
    brightBlack: '#6272A4',
    brightRed: '#FF6E6E',
    brightGreen: '#69FF94',
    brightYellow: '#FFFFA5',
    brightBlue: '#D6ACFF',
    brightMagenta: '#FF92DF',
    brightCyan: '#A4FFFF',
    brightWhite: '#FFFFFF',
  },
};

export function getTheme(name: string): Theme {
  return themes[name] || themes['matrix'];
}

export function getThemeNames(): string[] {
  return Object.keys(themes);
}
```

- [ ] **Step 2: Write theme command**

Create `src/commands/builtins/theme.ts`:

```ts
import type { CommandHandler } from '../../types';
import { getTheme, getThemeNames } from '../../themes/themes';

export const themeCommand: CommandHandler = (ctx, parsed) => {
  if (parsed.args.length === 0) {
    const current = ctx.theme;
    const names = getThemeNames();
    const list = names.map(n => (n === current ? `* ${n}` : `  ${n}`)).join('\r\n');
    return { output: `Current theme: ${current}\r\n\r\n${list}\r\n` };
  }

  const name = parsed.args[0];
  const theme = getTheme(name);
  if (!theme || !getThemeNames().includes(name)) {
    return { output: `theme: ${name}: theme not found. Available: ${getThemeNames().join(', ')}\r\n` };
  }

  ctx.setTheme(name);
  return { output: `Theme changed to ${name}\r\n` };
};
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add theme system and theme command"
```

---

### Task 12: Terminal Component

**Files:**
- Create: `src/terminal/useTerminal.ts`
- Create: `src/terminal/Terminal.tsx`
- Create: `src/terminal/Terminal.css`

**Consumes:** All previous tasks

- [ ] **Step 1: Write useTerminal hook**

Create `src/terminal/useTerminal.ts`:

```ts
import { useRef, useCallback, useState } from 'react';
import type { Terminal as XTermType } from 'xterm';
import type { DirNode, FSEntry } from '../types';
import type { ReactNode } from 'react';
import { createInitialFS, resolvePath, getNode } from '../fs/filesystem';
import { parseCommand } from '../commands/parser';
import { createRegistry } from '../commands/registry';
import { createHelpCommand } from '../commands/builtins/help';
import { echoCommand } from '../commands/builtins/echo';
import { clearCommand } from '../commands/builtins/clear';
import { pwdCommand } from '../commands/builtins/pwd';
import { whoamiCommand } from '../commands/builtins/whoami';
import { createHistoryCommand } from '../commands/builtins/history';
import { lsCommand } from '../commands/builtins/ls';
import { createCdCommand } from '../commands/builtins/cd';
import { grepCommand } from '../commands/builtins/grep';
import { catCommand } from '../commands/builtins/cat';
import { themeCommand } from '../commands/builtins/theme';

export interface TerminalState {
  cwd: string;
  theme: string;
  history: string[];
  richContent: ReactNode | null;
}

export function useTerminal() {
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<any>(null);
  const [state, setState] = useState<TerminalState>({
    cwd: '/home/user',
    theme: 'matrix',
    history: [],
    richContent: null,
  });

  const fsRef = useRef<DirNode>(createInitialFS());
  const inputBufferRef = useRef('');
  const historyIndexRef = useRef(-1);
  const prevCwdRef = useRef('/home/user');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const writePrompt = useCallback(() => {
    const term = xtermRef.current;
    if (!term) return;
    const displayPath = state.cwd.replace('/home/user', '~');
    term.write('\r\n\x1b[1;32muser@ami\x1b[0m:\x1b[1;34m' + displayPath + '\x1b[0m$ ');
  }, [state.cwd]);

  const appendOutput = useCallback((text: string) => {
    xtermRef.current?.write(text);
  }, []);

  const setRichContent = useCallback((node: ReactNode | null) => {
    setState(prev => ({ ...prev, richContent: node }));
  }, []);

  const setCwd = useCallback((path: string) => {
    setState(prev => ({ ...prev, cwd: path }));
  }, []);

  const setTheme = useCallback((name: string) => {
    setState(prev => ({ ...prev, theme: name }));
  }, []);

  const executeCommand = useCallback((input: string) => {
    const term = xtermRef.current;
    if (!term) return;

    const parsed = parseCommand(input);
    if (!parsed) {
      writePrompt();
      return;
    }

    // Update history
    setState(prev => {
      const newHistory = [...prev.history, input];
      return { ...prev, history: newHistory };
    });

    const registry = createRegistry();

    // Register all commands
    registry.register('help', createHelpCommand(registry));
    registry.register('echo', echoCommand);
    registry.register('clear', clearCommand);
    registry.register('pwd', pwdCommand);
    registry.register('whoami', whoamiCommand);
    registry.register('history', createHistoryCommand(() => state.history));
    registry.register('ls', lsCommand);
    registry.register('cd', createCdCommand(
      () => prevCwdRef.current,
      (p: string) => { prevCwdRef.current = p; }
    ));
    registry.register('grep', grepCommand);
    registry.register('cat', catCommand);
    registry.register('theme', themeCommand);

    // Build context
    const ctx = {
      cwd: state.cwd,
      fs: fsRef.current,
      setCwd,
      appendOutput,
      setRichContent,
      theme: state.theme,
      setTheme,
    };

    const result = registry.execute(ctx, parsed);

    if (result) {
      term.write(result);
    }

    writePrompt();
  }, [state.cwd, state.history, state.theme, setCwd, setTheme, setRichContent, writePrompt]);

  const initTerminal = useCallback(async () => {
    const { Terminal } = await import('xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 15,
      lineHeight: 1.5,
      theme: {
        background: '#0D1117',
        foreground: '#00FF41',
        cursor: '#00FF41',
        selectionBackground: 'rgba(0, 255, 65, 0.3)',
      },
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    if (containerRef.current) {
      term.open(containerRef.current);
      fitAddon.fit();
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle input
    term.onData((data) => {
      // Handle Enter
      if (data === '\r') {
        const input = inputBufferRef.current;
        term.write('\r\n');
        executeCommand(input);
        inputBufferRef.current = '';
        historyIndexRef.current = -1;
        return;
      }

      // Handle Backspace
      if (data === '\x7f') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }

      // Handle Ctrl+L (clear)
      if (data === '\x0c') {
        term.clear();
        writePrompt();
        return;
      }

      // Handle Ctrl+C
      if (data === '\x03') {
        term.write('^C\r\n');
        inputBufferRef.current = '';
        writePrompt();
        return;
      }

      // Handle arrow up (history)
      if (data === '\x1b[A') {
        const history = state.history;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          historyIndexRef.current = history.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
        }
        // Clear current input
        while (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        inputBufferRef.current = history[historyIndexRef.current];
        term.write(inputBufferRef.current);
        return;
      }

      // Handle arrow down (history)
      if (data === '\x1b[B') {
        const history = state.history;
        // Clear current input
        while (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current++;
          inputBufferRef.current = history[historyIndexRef.current];
        } else {
          historyIndexRef.current = -1;
          inputBufferRef.current = '';
        }
        term.write(inputBufferRef.current);
        return;
      }

      // Handle Tab (autocomplete)
      if (data === '\t') {
        // Simple path autocomplete
        const buffer = inputBufferRef.current;
        const tokens = buffer.split(' ');
        const lastToken = tokens[tokens.length - 1] || '';
        const path = resolvePath(fsRef.current, state.cwd, lastToken);
        const node = getNode(fsRef.current, path);

        // TODO: implement full tab completion
        return;
      }

      // Normal character input
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    // Resize handling
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Write welcome message
    term.write(`\x1b[1;32m
   ___           _ 
  / _ \\         (_)
 / /_\\ \\_ __ ___ _ 
 |  _  | '  \\  \\ |
 | | | | | | |\\ \\ |
 \\_| |_/_| |_/__/ |
               __/ |
              |___/ 
\x1b[0m
Welcome to Ami Terminal v1.0.0
Type \x1b[1;32mhelp\x1b[0m to see available commands.

`);

    writePrompt();

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [executeCommand, writePrompt, state.cwd]);

  return {
    containerRef,
    initTerminal,
    state,
    fitAddonRef,
  };
}
```

- [ ] **Step 2: Write Terminal component**

Create `src/terminal/Terminal.tsx`:

```tsx
import React, { useEffect } from 'react';
import { useTerminal } from './useTerminal';
import MarkdownView from '../output/MarkdownView';
import './Terminal.css';

export default function Terminal() {
  const { containerRef, initTerminal, state } = useTerminal();

  useEffect(() => {
    const cleanup = initTerminal();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  return (
    <div className="terminal-shell">
      <div className="terminal-titlebar">
        <div className="titlebar-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="titlebar-text">Ami — Terminal</span>
        <div className="titlebar-spacer" />
      </div>
      <div className="terminal-content">
        <div ref={containerRef} className="terminal-xterm" />
        {state.richContent && (
          <div className="terminal-rich">
            {state.richContent}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write Terminal styles**

Create `src/terminal/Terminal.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #0D1117;
}

.terminal-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #0D1117;
}

.terminal-titlebar {
  display: flex;
  align-items: center;
  height: 32px;
  background: #161B22;
  border-bottom: 1px solid #30363D;
  padding: 0 12px;
  user-select: none;
  flex-shrink: 0;
}

.titlebar-dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot-red { background: #FF5F56; }
.dot-yellow { background: #FFBD2E; }
.dot-green { background: #27C93F; }

.titlebar-text {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: #8B949E;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.titlebar-spacer {
  flex: 1;
}

.terminal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-xterm {
  flex: 1;
  overflow: hidden;
}

.terminal-xterm .xterm {
  height: 100%;
  padding: 8px;
}

.terminal-rich {
  background: #0D1117;
  border-top: 1px solid #30363D;
  padding: 8px 24px 16px 24px;
  max-height: 50%;
  overflow-y: auto;
}
```

- [ ] **Step 4: Write App.tsx**

Create `src/App.tsx`:

```tsx
import Terminal from './terminal/Terminal';

export default function App() {
  return <Terminal />;
}
```

- [ ] **Step 5: Clean main.tsx**

Update `src/main.tsx` to only have:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Run dev server and test manually**

```bash
npm run dev
```

Expected: terminal loads with ASCII art, help command works, ls/cd/cat all functional.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add terminal component with xterm.js integration"
```

---

### Task 13: Build & Final Polish

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: clean build, no errors, `dist/` directory produced.

- [ ] **Step 2: Preview build locally**

```bash
npm run preview
```

Expected: functional terminal at localhost.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: final polish and build verification"
```

---

## Verification Checklist

Run through each verification step manually:

1. `npm run dev` — terminal loads, auto-focuses, shows ASCII art + MOTD
2. Type `help` — all 11 commands listed with descriptions
3. `ls` — shows `about.md`, `blog/`, `projects/`
4. `cd blog && ls` — shows `hello-world.md`
5. `cat ../about.md` — renders rich Markdown with proper styles
6. `grep -i "react" /home/user` — highlights matches with file paths
7. `theme dracula` — switches to Dracula color scheme
8. `clear` — clears screen
9. `history` — shows command history with line numbers
10. `npm run build` — produces `dist/` with no errors
