# 搜索面板（palette）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 `grep` 命令，新增一个 VSCode 命令面板风格的交互式搜索面板（`palette` + `Ctrl+P`），支持博客列表 / 内容搜索 / tag 浏览三种模式，选中博客后以 rich content 打开。

**Architecture:** 纯函数数据层 `blogIndex.ts`（可测）+ 自带状态和键盘处理的 `Palette` React 组件（塞进现有 `RichContent.node`）+ 一个 `palette` 命令（复用 `PanelProcess` 与 `MarkdownView`）。面板通过 `RichContentMeta.interactive` 标记让 `Terminal.tsx` 的滚动键监听让位，面板内用 `<input>` 捕获搜索文字。

**Tech Stack:** React 19 + TypeScript、xterm.js 6（不受影响）、Vitest、Vite。

**Spec:** `docs/superpowers/specs/2026-09-05-search-palette-design.md`

## Global Constraints

- 搜索范围：只搜 `/home/user/blog/**/*.md`。
- 匹配规则：大小写不敏感子串，匹配 `title` + 文件内容。
- 列表显示：frontmatter `title`，缺省回退文件名（去 `.md` 后缀）。
- 打开语义：复用 `MarkdownView` 面板，不打印到终端。
- 复用现有 `PanelProcess` / `process` 模型，不新增进程类型。
- 命令内用 `React.createElement`（不用 JSX，与 `whoami.ts`/`cat.ts` 一致）；组件内用 JSX（与 `MarkdownView.tsx`/`Terminal.tsx` 一致）。
- Commit message 遵循仓库的 conventional commits 风格（`feat(search):` / `refactor(search):` / `docs(search):`）。
- 每个任务结束：`npm test`、`npm run lint`、`npm run build` 全绿（Task 7 做一次完整验证）。

---

### Task 1: 数据层 `blogIndex.ts`（TDD）

**Files:**
- Create: `src/fs/blogIndex.ts`
- Test: `src/__tests__/blogIndex.test.ts`

**Interfaces:**
- Consumes: `getNode` from `src/fs/filesystem.ts`；`DirNode` from `src/types.ts`。
- Produces: `BlogInfo`（interface）、`parseFrontmatter`、`listBlogs`、`listTags`、`searchBlogs`——后续 Task 3/4 依赖这些精确签名。

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/blogIndex.test.ts
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, listBlogs, listTags, searchBlogs } from '../fs/blogIndex';
import type { DirNode } from '../types';

const file = (content: string) => ({ type: 'file' as const, content });

function makeFs(): DirNode {
  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          user: {
            type: 'dir',
            children: {
              blog: {
                type: 'dir',
                children: {
                  'a.md': file('---\ntitle: Alpha\ntags: Foo, Bar\n---\nhello world'),
                  'b.md': file('---\ntitle: Beta\ntags: bar\n---\nsecond post'),
                  'note.txt': file('not a blog'),
                  sub: { type: 'dir', children: { 'c.md': file('no frontmatter, just content') } },
                },
              },
            },
          },
        },
      },
    },
  };
}

describe('parseFrontmatter', () => {
  it('extracts title and lowercased, trimmed tags', () => {
    const r = parseFrontmatter('---\ntitle: Alpha\ntags: Foo, Bar\n---\nbody');
    expect(r.title).toBe('Alpha');
    expect(r.tags).toEqual(['foo', 'bar']);
  });

  it('returns empty when no frontmatter', () => {
    const r = parseFrontmatter('just content');
    expect(r.title).toBeUndefined();
    expect(r.tags).toEqual([]);
  });
});

describe('listBlogs', () => {
  it('lists .md under /home/user/blog recursively, skipping other types, sorted by path', () => {
    const blogs = listBlogs(makeFs());
    expect(blogs.map((b) => b.path)).toEqual([
      '/home/user/blog/a.md',
      '/home/user/blog/b.md',
      '/home/user/blog/sub/c.md',
    ]);
  });

  it('falls back to filename when title is missing', () => {
    const blogs = listBlogs(makeFs());
    expect(blogs.find((b) => b.path.endsWith('c.md'))!.title).toBe('c');
  });
});

describe('listTags', () => {
  it('dedupes and sorts tags', () => {
    expect(listTags(listBlogs(makeFs()))).toEqual(['bar', 'foo']);
  });
});

describe('searchBlogs', () => {
  const blogs = listBlogs(makeFs());

  it('matches title case-insensitively', () => {
    expect(searchBlogs(blogs, 'alpha').map((b) => b.title)).toEqual(['Alpha']);
  });

  it('matches content', () => {
    expect(searchBlogs(blogs, 'second').map((b) => b.title)).toEqual(['Beta']);
  });

  it('returns empty on no match', () => {
    expect(searchBlogs(blogs, 'zzzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/__tests__/blogIndex.test.ts`
Expected: FAIL — `Failed to resolve import "../fs/blogIndex"`（模块不存在）。

- [ ] **Step 3: 写实现**

```ts
// src/fs/blogIndex.ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/__tests__/blogIndex.test.ts`
Expected: PASS（6 个测试）。

- [ ] **Step 5: Commit**

```bash
git add src/fs/blogIndex.ts src/__tests__/blogIndex.test.ts
git commit -m "feat(search): add blog index data layer"
```

---

### Task 2: 抽出 `openMarkdownPanel` 共享 helper

**Files:**
- Create: `src/commands/openMarkdown.ts`
- Modify: `src/commands/builtins/cat.ts`（`.md` 分支改用它）

**Interfaces:**
- Consumes: `ctx.spawnPanel` / `proc.setView`（现有 `PanelProcess` API）。
- Produces: `openMarkdownPanel(ctx, name, title, rawContent): PanelProcess`——Task 4 的 `palette.ts` 依赖它。

- [ ] **Step 1: 新建 helper**

```ts
// src/commands/openMarkdown.ts
import React from 'react';
import type { CommandContext } from '../types';
import type { PanelProcess } from '../process/panelProcess';

/**
 * Opens a `.md` file as a rich Markdown panel, reusing cat's lazy-load
 * pattern (loading placeholder → MarkdownView). Shared by `cat` and `palette`.
 */
export function openMarkdownPanel(
  ctx: CommandContext,
  name: string,
  title: string,
  rawContent: string
): PanelProcess {
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const body = frontmatterMatch ? frontmatterMatch[2] : rawContent;

  const proc = ctx.spawnPanel(name, {
    node: React.createElement('div', { className: 'markdown-loading' }, 'Loading...'),
    meta: { title, type: 'markdown' },
  });

  import('../output/MarkdownView').then(({ default: MarkdownView }) => {
    proc.setView({
      node: React.createElement(MarkdownView, { content: body }),
      meta: { title, type: 'markdown' },
    });
  });

  return proc;
}
```

- [ ] **Step 2: 改 `cat.ts` 的 `.md` 分支**

在 `src/commands/builtins/cat.ts` 顶部加 import：

```ts
import { openMarkdownPanel } from '../openMarkdown';
```

把 `.md` 分支（原 `if (target.endsWith('.md')) { ... }` 整段，含 frontmatter 正则与动态 import）替换为：

```ts
  // .md files → rich Markdown rendering (lazy loaded)
  if (target.endsWith('.md')) {
    openMarkdownPanel(ctx, `cat ${target}`, target, node.content);
    return '';
  }
```

注意：`cat.ts` 顶部仍保留 `import React from 'react'`（图片分支还用 `React.createElement('img', ...)`），只删掉 `.md` 分支里的内联 frontmatter 解析与 `import('../../output/MarkdownView')` 动态导入。

- [ ] **Step 3: 验证**

Run: `npm test && npm run lint && npm run build`
Expected: 全绿（现有 57 测试 + 新 6 测试）。

- [ ] **Step 4: Commit**

```bash
git add src/commands/openMarkdown.ts src/commands/builtins/cat.ts
git commit -m "refactor(search): extract openMarkdownPanel helper"
```

---

### Task 3: `Palette` 交互组件 + 样式

**Files:**
- Create: `src/components/Palette.tsx`
- Create: `src/components/Palette.css`

**Interfaces:**
- Consumes: `BlogInfo`、`listTags`、`searchBlogs` from `src/fs/blogIndex.ts`。
- Produces: 默认导出 `Palette` 组件，props `{ blogs: BlogInfo[]; onOpen: (path: string) => void; onClose: () => void }`——Task 4 的 `palette.ts` 用它。

- [ ] **Step 1: 写组件**

```tsx
// src/components/Palette.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlogInfo } from '../fs/blogIndex';
import { listTags, searchBlogs } from '../fs/blogIndex';
import './Palette.css';

type Mode = 'blogs' | 'search' | 'tags';

type Item =
  | { kind: 'blog'; blog: BlogInfo }
  | { kind: 'tag'; tag: string };

const MODES: { id: Mode; label: string }[] = [
  { id: 'blogs', label: '博客' },
  { id: 'search', label: '搜索' },
  { id: 'tags', label: 'tag' },
];

interface PaletteProps {
  blogs: BlogInfo[];
  onOpen: (path: string) => void;
  onClose: () => void;
}

export default function Palette({ blogs, onOpen, onClose }: PaletteProps) {
  const [mode, setMode] = useState<Mode>('blogs');
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const tags = useMemo(() => listTags(blogs), [blogs]);

  const items = useMemo<Item[]>(() => {
    if (mode === 'blogs') return blogs.map((blog) => ({ kind: 'blog', blog }));
    if (mode === 'search') return searchBlogs(blogs, query).map((blog) => ({ kind: 'blog', blog }));
    // tags mode
    if (tag === null) return tags.map((t) => ({ kind: 'tag', tag: t }));
    return blogs.filter((b) => b.tags.includes(tag)).map((blog) => ({ kind: 'blog', blog }));
  }, [mode, blogs, query, tag, tags]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected(0);
    if (m === 'search') requestAnimationFrame(() => inputRef.current?.focus());
    else inputRef.current?.blur();
  };

  const activate = (item: Item) => {
    if (item.kind === 'blog') onOpen(item.blog.path);
    else {
      setTag(item.tag);
      setSelected(0);
    }
  };

  // Latest-handler-in-ref so the window listener never goes stale.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelected((s) => Math.min(items.length - 1, s + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selected]) activate(items[selected]);
        break;
      case 'Escape':
        e.preventDefault();
        if (mode === 'tags' && tag !== null) {
          setTag(null);
          setSelected(0);
        } else {
          onClose();
        }
        break;
      case 'Tab':
        e.preventDefault();
        switchMode(MODES[(MODES.findIndex((x) => x.id === mode) + 1) % MODES.length].id);
        break;
      case '1':
        e.preventDefault();
        switchMode('blogs');
        break;
      case '2':
        e.preventDefault();
        switchMode('search');
        break;
      case '3':
        e.preventDefault();
        switchMode('tags');
        break;
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  const safeSelected = Math.min(selected, Math.max(items.length - 1, 0));

  return (
    <div className="palette">
      <div className="palette-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? 'palette-tab palette-tab-active' : 'palette-tab'}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'search' && (
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          placeholder="输入关键词搜索…"
          autoFocus
        />
      )}

      <div className="palette-list">
        {items.length === 0 ? (
          <div className="palette-empty">无结果</div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.kind === 'blog' ? item.blog.path : item.tag}
              className={i === safeSelected ? 'palette-item palette-item-selected' : 'palette-item'}
              onMouseEnter={() => setSelected(i)}
              onClick={() => activate(item)}
            >
              {item.kind === 'blog' ? (
                <>
                  <span className="palette-item-title">{item.blog.title}</span>
                  <span className="palette-item-path">{item.blog.path}</span>
                </>
              ) : (
                <span className="palette-item-title">#{item.tag}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写样式**

```css
/* src/components/Palette.css */
.palette {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Noto Sans Mono CJK SC', 'Microsoft YaHei', 'PingFang SC', monospace;
}

.palette-tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #30363d;
}

.palette-tab {
  background: none;
  border: none;
  color: #888;
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 4px;
}

.palette-tab-active {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

.palette-input {
  margin: 12px 0;
  padding: 8px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.palette-input:focus {
  border-color: #58a6ff;
}

.palette-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.palette-list::-webkit-scrollbar {
  display: none;
}

.palette-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.palette-item-selected {
  background: rgba(255, 255, 255, 0.08);
}

.palette-item-title {
  color: #e0e0e0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-item-path {
  color: #666;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-empty {
  color: #666;
  padding: 12px 10px;
  font-size: 14px;
}
```

- [ ] **Step 3: 验证**

Run: `npm run lint && npm run build`
Expected: 无告警、构建成功。（此任务无单测，交互行为 Task 7 用浏览器手工验证。）

- [ ] **Step 4: Commit**

```bash
git add src/components/Palette.tsx src/components/Palette.css
git commit -m "feat(search): add Palette interactive component"
```

---

### Task 4: `palette` 命令 + 移除 grep

**Files:**
- Create: `src/commands/builtins/palette.ts`
- Delete: `src/commands/builtins/grep.ts`
- Modify: `src/types.ts`（`RichContentMeta` 加 `interactive?: boolean`）
- Modify: `src/commands/register.ts`
- Modify: `src/commands/descriptions.ts`

**Interfaces:**
- Consumes: `listBlogs`、`openMarkdownPanel`、`Palette`。
- Produces: `paletteCommand: CommandHandler`（注册为 `palette`）；`RichContentMeta.interactive`（Task 5 消费）。

- [ ] **Step 1: 加 `interactive` 字段**

`src/types.ts` 的 `RichContentMeta` 改为：

```ts
export interface RichContentMeta {
  title: string;
  type: string;
  interactive?: boolean;
}
```

- [ ] **Step 2: 新建 `palette` 命令**

```ts
// src/commands/builtins/palette.ts
import React from 'react';
import type { CommandHandler } from '../../types';
import type { PanelProcess } from '../../process/panelProcess';
import { listBlogs } from '../../fs/blogIndex';
import { openMarkdownPanel } from '../openMarkdown';
import Palette from '../../components/Palette';

export const paletteCommand: CommandHandler = (ctx) => {
  const blogs = listBlogs(ctx.fs);

  let proc: PanelProcess;

  const onOpen = (path: string) => {
    const blog = blogs.find((b) => b.path === path);
    if (!blog) return;
    ctx.manager.signal(proc.pid, 'SIGTERM');
    openMarkdownPanel(ctx, `cat ${path}`, blog.title, blog.content);
  };
  const onClose = () => {
    ctx.manager.signal(proc.pid, 'SIGTERM');
  };

  proc = ctx.spawnPanel('palette', {
    node: React.createElement(Palette, { blogs, onOpen, onClose }),
    meta: { title: 'palette', type: 'palette', interactive: true },
  });
  return '';
};
```

- [ ] **Step 3: 注册并更新描述**

`src/commands/register.ts`：
- 删除 `import { grepCommand } from './builtins/grep';`
- 加 `import { paletteCommand } from './builtins/palette';`
- 删除 `registry.register('grep', grepCommand);`
- 加 `registry.register('palette', paletteCommand);`（放 `grep` 原位置即可）

`src/commands/descriptions.ts`：
- `fileArgCommands`：删掉 `'grep'`（palette 不接受文件参数，不加入）。
- `commandFlags`：删掉 `grep: [...]` 那一行（palette 无 flag，不加入）。
- `commandNames`：把 `'grep'` 换成 `'palette'`。
- `commandDescriptions`：删 `grep` 条目，加 `palette: 'open the search palette (blogs / search / tags)'`。

- [ ] **Step 4: 删除 grep.ts**

```bash
git rm src/commands/builtins/grep.ts
```

- [ ] **Step 5: 验证**

Run: `npm test && npm run lint && npm run build`
Expected: 全绿。（`grep` 已不在命令表，`palette` 在。搜索整个仓库确认无残留 `grep` 引用：`grep -rn "grep" src README.md` 应只剩无关命中，如 `openMarkdownPanel`/`palette` 注释不含 `grep`。）

- [ ] **Step 6: Commit**

```bash
git add src/commands/builtins/palette.ts src/types.ts src/commands/register.ts src/commands/descriptions.ts
git commit -m "feat(search): add palette command and remove grep"
```

---

### Task 5: 键盘路由（Ctrl+P + interactive gate）

**Files:**
- Modify: `src/terminal/Terminal.tsx`（keydown 监听按 `interactive` gate；interactive 面板的 hint 文案）
- Modify: `src/terminal/input.ts`（`\x10` → `openPalette`）
- Modify: `src/terminal/useTerminal.ts`（抽出 `buildContext`、加 `openPalette`、传给 input handler）

**Interfaces:**
- Consumes: `RichContentMeta.interactive`（Task 4）；`palette` 命令（Task 4 注册）。
- Produces: `openPalette: () => void`（作为 `InputHandlerDeps` 新字段）。

- [ ] **Step 1: `input.ts` 加 dep 与 `\x10` 分支**

`src/terminal/input.ts` 的 `InputHandlerDeps` 加一个字段：

```ts
  openPalette: () => void;
```

在 `createInputHandler` 的解构里加 `openPalette,`。

在「Handle Ctrl+W (delete word)」分支之后、箭头键分支之前，加：

```ts
    // Handle Ctrl+P (open the search palette)
    if (data === '\x10') {
      openPalette();
      return;
    }
```

（面板打开时 `\x10` 会被函数顶部的 foreground guard 拦下，符合「已有面板时不另开面板」。）

- [ ] **Step 2: `useTerminal.ts` 抽 `buildContext` 并加 `openPalette`**

`src/terminal/useTerminal.ts`：

1. import 加 `CommandContext`：把 `import type { DirNode, RichContent } from '../types';` 改为 `import type { DirNode, RichContent, CommandContext } from '../types';`。

2. 在 `executeCommand` 之前新增：

```ts
  const buildContext = useCallback((): CommandContext => {
    return {
      cwd: cwdRef.current,
      fs: fsRef.current,
      setCwd,
      appendOutput,
      manager: processManagerRef.current,
      spawnPanel,
      theme: themeRef.current,
      setTheme,
      termCols: xtermRef.current?.cols ?? 80,
    };
  }, [setCwd, appendOutput, spawnPanel, setTheme, cwdRef, themeRef]);

  const openPalette = useCallback(() => {
    getRegistry().execute(buildContext(), { cmd: 'palette', args: [], flags: [] });
  }, [getRegistry, buildContext]);
```

3. 把 `executeCommand` 内联的 `const ctx = { ... }` 那段删掉，换成 `const ctx = buildContext();`。（其余逻辑不变：仍 `if (!term) return;`、`parseCommand`、history 更新、`registry.execute(ctx, parsed)`、`writePrompt()`。）

4. 在 `initTerminal` 里 `createInputHandler({ ... })` 的 deps 对象里加 `openPalette,`。

5. 更新 `initTerminal` 的依赖数组：加入 `openPalette`（`buildContext` 已在 `executeCommand` 依赖里体现，`openPalette` 依赖 `buildContext` 与 `getRegistry`，把 `openPalette` 加进 `initTerminal` 的 `useCallback` 依赖数组）。

- [ ] **Step 3: `Terminal.tsx` 加 interactive gate**

在 keydown 监听的 `useEffect` 开头，`if (!richContent) return;` 之后加：

```ts
    // The palette handles its own keyboard input; skip the panel scroll keys.
    if (richContent.meta.interactive) return;
```

同时，把状态栏 hint 对 interactive 面板区分（原 `q / Esc 关闭` 对 palette 不准确）。把：

```tsx
<span className="terminal-rich-status-hint">q / Esc 关闭</span>
```

改为：

```tsx
<span className="terminal-rich-status-hint">
  {richContent.meta.interactive ? '↑/↓ 选择 · Enter 打开 · Esc 返回 · Tab 切换' : 'q / Esc 关闭'}
</span>
```

- [ ] **Step 4: 验证**

Run: `npm run lint && npm run build`
Expected: 无告警、构建成功。

- [ ] **Step 5: Commit**

```bash
git add src/terminal/Terminal.tsx src/terminal/input.ts src/terminal/useTerminal.ts
git commit -m "feat(search): route keyboard input to the palette"
```

---

### Task 6: 文档（README + help）

**Files:**
- Modify: `README.md`
- Modify: `src/commands/builtins/help.ts`

**Interfaces:** 无（纯文档）。

- [ ] **Step 1: README**

`README.md` 的 Commands 表：删掉 `| grep <pattern> <file> | ... |` 行，加：

```markdown
| `palette` | Open the search palette (blogs / search / tags) |
```

Features 列表，在 `- **Rich-content panel** ...` 那行后加：

```markdown
- **Search palette** — `palette` / `Ctrl+P`: browse blogs, full-text search, or tags; ↑/↓ + Enter to open a post
```

- [ ] **Step 2: help 快捷键**

`src/commands/builtins/help.ts` 的 `Keyboard shortcuts:` 区加一行：

```ts
    output += '  Ctrl+P   open search palette\r\n';
```

- [ ] **Step 3: 验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add README.md src/commands/builtins/help.ts
git commit -m "docs(search): document palette in README and help"
```

---

### Task 7: 完整验证

**Files:** 无（验证 + 可选手工检查）

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 8 个测试文件全过（含新增 `blogIndex.test.ts`）。

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: 无告警、构建成功。

- [ ] **Step 3: 手工验证（`npm run dev`）**

用 `run` skill 起应用，逐项确认：
1. `palette` 命令打开面板，顶部三个 tab。
2. 「博客」模式：↑/↓ 移动高亮、Enter 打开博客（rich content）、Esc 关闭。
3. 「搜索」模式：输入聚焦、实时过滤、Enter 打开、无结果显示「无结果」。
4. 「tag」模式：列出 tag、Enter 进入该 tag 博客列表、Esc 返回、再 Enter 打开。
5. `Ctrl+P` 打开面板；面板打开时 `Ctrl+P` 不重复打开。
6. 打开博客后（`MarkdownView` 面板），`q`/`Esc`/`j`/`k`/`G` 滚动键仍正常（非 interactive 面板行为不变）。
7. `help` 里无 grep、有 palette；Tab 补全 `pal` → `palette`。

- [ ] **Step 4: 确认工作树干净并推送**

```bash
git status          # 应无未提交改动
git log --oneline   # 7 个新提交在 feat/search 之上
```

（推送由用户在确认后发起，或按需 `git push -u origin feat/search`。）

---

## Self-Review 记录

- **Spec 覆盖**：数据层（Task 1）↔ spec 的 blogIndex 节；`openMarkdownPanel`（Task 2）↔ 共享 helper 节；`Palette`（Task 3）↔ 组件节；`palette` 命令 + 移除 grep（Task 4）↔ 命令/移除节；`interactive` gate + Ctrl+P（Task 5）↔ 终端集成节；README/help（Task 6）↔ 文档节。所有 spec 决策 #1–#8 均有对应任务。
- **Placeholder**：无 TBD/TODO；每个代码步骤含完整代码。
- **类型一致性**：`BlogInfo`（Task 1 定义）在 Task 3/4 中以 `BlogInfo` 引用；`openMarkdownPanel` 签名在 Task 2 定义、Task 4 调用；`openPalette` 在 Task 5 定义并传入 `InputHandlerDeps`。
