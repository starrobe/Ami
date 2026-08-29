# Rich Content Vim 状态栏 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 rich content 浮层在底部添加一条 vim 风格状态栏，显示文件名、类型和（markdown 的）滚动百分比。

**Architecture:** 把 `TerminalState.richContent` 从裸 `ReactNode` 升级为 `{ node, meta }` 结构，命令（`cat`/`whoami`）声明元信息，状态栏渲染逻辑集中在 `Terminal.tsx`。滚动百分比抽成纯函数 `formatScrollPosition` 并单测。

**Tech Stack:** React 19 + TypeScript 7 + Vite 8 + Vitest 4。

## Global Constraints

- 状态栏位于面板底部，暗色低调条：深色背景（继承 `--ami-bg`）+ 灰色文字 + 顶部 `1px solid #30363D` 边框。
- 等宽字体栈与终端一致：`'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Noto Sans Mono CJK SC', 'Microsoft YaHei', 'PingFang SC', monospace`。
- 滚动百分比仅当 `type === 'markdown'` 时显示；图片与 whoami 右侧留空。
- 图片 `type` 为无点扩展名（`png`/`jpg`/`gif`/`webp`/`svg`/`bmp`/`ico`）；whoami `type` 为 `profile`。
- 现有测试仅有纯单元测试（`vitest run`，无 jsdom/testing-library），React 组件改动靠 `tsc -b` + `vite build` + 手动验证。
- 每次提交后 `npm run build` 必须通过（`tsc -b` 类型检查）。

---

### Task 1: `formatScrollPosition` 纯函数 + 单测

**Files:**
- Create: `src/utils/scrollPosition.ts`
- Create: `src/__tests__/scrollPosition.test.ts`

**Interfaces:**
- Produces: `formatScrollPosition(scrollTop: number, scrollHeight: number, clientHeight: number): string` — 后续 Task 3 在 `Terminal.tsx` 的 `onScroll` 中调用。

- [ ] **Step 1: 写失败测试**

创建 `src/__tests__/scrollPosition.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { formatScrollPosition } from '../utils/scrollPosition';

describe('formatScrollPosition', () => {
  it('returns Top when content is not scrollable', () => {
    expect(formatScrollPosition(0, 200, 300)).toBe('Top');
  });

  it('returns Top at the top of scrollable content', () => {
    expect(formatScrollPosition(0, 1000, 300)).toBe('Top');
  });

  it('returns the rounded percentage mid-scroll', () => {
    // scrollTop 400 of max 700 → 57.14% → 57%
    expect(formatScrollPosition(400, 1000, 300)).toBe('57%');
  });

  it('returns Bot at the very bottom', () => {
    expect(formatScrollPosition(700, 1000, 300)).toBe('Bot');
  });

  it('returns Bot just before the very bottom', () => {
    expect(formatScrollPosition(699, 1000, 300)).toBe('Bot');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/__tests__/scrollPosition.test.ts`
Expected: FAIL — `Cannot find module '../utils/scrollPosition'`。

- [ ] **Step 3: 实现函数**

创建 `src/utils/scrollPosition.ts`：

```ts
/**
 * Formats a scroll position into vim's statusline convention:
 * "Top" when at the top or not scrollable, "Bot" when at the bottom,
 * otherwise "NN%".
 */
export function formatScrollPosition(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): string {
  const max = scrollHeight - clientHeight;
  if (max <= 0 || scrollTop <= 0) return 'Top';
  if (scrollTop >= max - 1) return 'Bot';
  return `${Math.round((scrollTop / max) * 100)}%`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/__tests__/scrollPosition.test.ts`
Expected: PASS（5 个用例全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/scrollPosition.ts src/__tests__/scrollPosition.test.ts
git commit -m "feat: add formatScrollPosition util for vim-style scroll percentage"
```

---

### Task 2: 引入 `RichContent` 状态模型（纯重构，行为不变）

**Files:**
- Modify: `src/types.ts`
- Modify: `src/terminal/useTerminal.ts`
- Modify: `src/terminal/Terminal.tsx`

**Interfaces:**
- Produces: 导出类型 `RichContentMeta { title: string; type: string }` 和 `RichContent { node: ReactNode; meta: RichContentMeta }`（`src/types.ts`）。
- Produces: `CommandContext.setRichContent(node: ReactNode | null, meta?: RichContentMeta) => void`；`TerminalState.richContent: RichContent | null`。
- 此任务结束时 `cat`/`whoami` 仍调用 `setRichContent(node)`（meta 缺省 → `{ title: '', type: '' }`），行为与现状一致。

- [ ] **Step 1: 在 `src/types.ts` 加类型**

在 `export type FSEntry = FileNode | DirNode;`（第 18 行）之后新增：

```ts
export interface RichContentMeta {
  title: string;
  type: string;
}

export interface RichContent {
  node: ReactNode;
  meta: RichContentMeta;
}
```

并把 `CommandContext` 里的 `setRichContent` 声明（第 29 行）从：

```ts
  setRichContent: (node: ReactNode | null) => void;
```

改为：

```ts
  setRichContent: (node: ReactNode | null, meta?: RichContentMeta) => void;
```

- [ ] **Step 2: 更新 `src/terminal/useTerminal.ts`**

顶部 import（第 3 行）从：

```ts
import type { DirNode } from '../types';
```

改为：

```ts
import type { DirNode, RichContent, RichContentMeta } from '../types';
```

`TerminalState` 接口（第 32 行）的 `richContent` 字段从：

```ts
  richContent: ReactNode | null;
```

改为：

```ts
  richContent: RichContent | null;
```

`setRichContent` 实现（第 155-157 行）从：

```ts
  const setRichContent = useCallback((node: ReactNode | null) => {
    setState(prev => ({ ...prev, richContent: node }));
  }, []);
```

改为：

```ts
  const setRichContent = useCallback((node: ReactNode | null, meta?: RichContentMeta) => {
    setState(prev => ({
      ...prev,
      richContent: node === null ? null : { node, meta: meta ?? { title: '', type: '' } },
    }));
  }, []);
```

- [ ] **Step 3: 在 `src/terminal/Terminal.tsx` 解包 node**

把第 36 行的：

```tsx
              <div className="terminal-rich-body">{state.richContent}</div>
```

改为：

```tsx
              <div className="terminal-rich-body">{state.richContent.node}</div>
```

- [ ] **Step 4: 构建 + 测试确认通过**

Run: `npm run build`
Expected: 类型检查与打包通过。

Run: `npm test`
Expected: 现有测试 + Task 1 测试全绿。

- [ ] **Step 5: 提交**

```bash
git add src/types.ts src/terminal/useTerminal.ts src/terminal/Terminal.tsx
git commit -m "refactor: carry file metadata alongside rich content node"
```

---

### Task 3: 渲染状态栏 + 命令传递元信息

**Files:**
- Modify: `src/terminal/Terminal.tsx`
- Modify: `src/terminal/Terminal.css`
- Modify: `src/commands/builtins/cat.ts`
- Modify: `src/commands/builtins/whoami.ts`

**Interfaces:**
- Consumes: `formatScrollPosition`（Task 1）、`RichContent`/`setRichContent(node, meta)`（Task 2）。
- Produces: 状态栏 footer `.terminal-rich-status`，滚动百分比随 `.terminal-rich-body` 滚动实时更新。

- [ ] **Step 1: 重写 `src/terminal/Terminal.tsx`**

整文件替换为：

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTerminal } from './useTerminal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatScrollPosition } from '../utils/scrollPosition';
import './Terminal.css';

export default function Terminal() {
  const { containerRef, initTerminal, state, setRichContent } = useTerminal();
  const richBodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollLabel, setScrollLabel] = useState('Top');

  useEffect(() => {
    let disposed = false;
    let cleanupFn: (() => void) | undefined;

    initTerminal().then((fn) => {
      if (disposed) {
        fn?.();
      } else {
        cleanupFn = fn;
      }
    });

    return () => {
      disposed = true;
      cleanupFn?.();
    };
  }, [initTerminal]);

  // Reset scroll position and label whenever the rich content changes
  useEffect(() => {
    if (richBodyRef.current) richBodyRef.current.scrollTop = 0;
    setScrollLabel('Top');
  }, [state.richContent]);

  return (
    <div className="terminal-shell">
      <div className="terminal-content">
        <div ref={containerRef} className="terminal-xterm" />
      </div>
      {state.richContent && (
        <ErrorBoundary>
          <div className="terminal-rich-backdrop" onClick={() => setRichContent(null)}>
            <div className="terminal-rich" onClick={(e) => e.stopPropagation()}>
              <div
                ref={richBodyRef}
                className="terminal-rich-body"
                onScroll={(e) =>
                  setScrollLabel(
                    formatScrollPosition(
                      e.currentTarget.scrollTop,
                      e.currentTarget.scrollHeight,
                      e.currentTarget.clientHeight
                    )
                  )
                }
              >
                {state.richContent.node}
              </div>
              <div className="terminal-rich-status">
                <span className="terminal-rich-status-left">
                  {state.richContent.meta.title}
                  {state.richContent.meta.type && (
                    <span className="terminal-rich-status-type">[{state.richContent.meta.type}]</span>
                  )}
                </span>
                {state.richContent.meta.type === 'markdown' && (
                  <span className="terminal-rich-status-scroll">{scrollLabel}</span>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 更新 `src/terminal/Terminal.css` 布局与状态栏样式**

把 `.terminal-rich` 规则（第 113-129 行）里的 `padding: 16px 24px;` 一行删掉（body 改为自带 padding，状态栏才可通栏贴底）。

把 `.terminal-rich-body` 规则（第 131-136 行）从：

```css
.terminal-rich-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}
```

改为：

```css
.terminal-rich-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 16px 24px;
}
```

在 `.terminal-rich-body::-webkit-scrollbar` 规则（第 145-147 行）之后新增状态栏样式：

```css
.terminal-rich-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 24px;
  border-top: 1px solid #30363D;
  color: #888;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Noto Sans Mono CJK SC', 'Microsoft YaHei', 'PingFang SC', monospace;
  font-size: 13px;
}

.terminal-rich-status-left {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-rich-status-type {
  margin-left: 8px;
  color: #666;
}

.terminal-rich-status-scroll {
  flex-shrink: 0;
}
```

- [ ] **Step 3: 在 `src/commands/builtins/cat.ts` 传递元信息**

图片分支（第 26-35 行）的 `ctx.setRichContent(...)` 调用，追加第二个参数 `{ title: target, type: ext.slice(1) }`：

```ts
  if (IMAGE_EXTS.includes(ext)) {
    ctx.setRichContent(
      React.createElement('img', {
        src: node.content,
        alt: target,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
      }),
      { title: target, type: ext.slice(1) }
    );
    return '';
  }
```

md loading 分支（第 44-46 行）追加 `{ title: target, type: 'markdown' }`：

```ts
    ctx.setRichContent(
      React.createElement('div', { className: 'markdown-loading' }, 'Loading...'),
      { title: target, type: 'markdown' }
    );
```

md 完成分支（第 49-52 行）追加 `{ title: target, type: 'markdown' }`：

```ts
    import('../../output/MarkdownView').then(({ default: MarkdownView }) => {
      ctx.setRichContent(
        React.createElement(MarkdownView, { content: body }),
        { title: target, type: 'markdown' }
      );
    });
```

- [ ] **Step 4: 在 `src/commands/builtins/whoami.ts` 传递元信息**

把第 28 行的：

```ts
  ctx.setRichContent(React.createElement(WhoamiPanel));
```

改为：

```ts
  ctx.setRichContent(React.createElement(WhoamiPanel), { title: 'whoami', type: 'profile' });
```

- [ ] **Step 5: 构建 + 测试确认通过**

Run: `npm run build`
Expected: 通过。

Run: `npm test`
Expected: 全部测试通过。

Run: `npm run lint`
Expected: 无报错。

- [ ] **Step 6: 手动验证**

Run: `npm run dev`，浏览器打开本地地址，逐条验证：

1. `cat blog/lock-free-stack.md` → 面板底部显示 `blog/lock-free-stack.md [markdown]`，右侧初始 `Top`；向下滚动显示 `NN%`，到底显示 `Bot`。
2. `cat demo.png` → 底部显示 `demo.png [png]`，右侧无百分比。
3. `whoami` → 底部显示 `whoami [profile]`，右侧无百分比。
4. 点击遮罩或 `clear` / `Ctrl+C` → 面板与状态栏一起消失。
5. 打开一个 md 后切换打开另一个 md → 滚动回到顶部，百分比重置为 `Top`。

- [ ] **Step 7: 提交**

```bash
git add src/terminal/Terminal.tsx src/terminal/Terminal.css src/commands/builtins/cat.ts src/commands/builtins/whoami.ts
git commit -m "feat: add vim-style status bar to rich content overlay"
```
