# Rich Content Vim 状态栏 — 设计文档

日期：2026-08-29
分支：`feature/floating-richcontent`

## 目标

为 rich content 浮层（`.terminal-rich` 面板）在底部添加一条 vim 风格的状态栏，显示当前预览的「文件信息」：文件名、类型、滚动百分比。

## 需求

1. 状态栏位于面板底部。
2. 左侧显示 `文件名 [类型]`。
3. 右侧显示滚动百分比（仅 markdown 预览时显示）。
4. 适用范围：`cat` 打开的 markdown、图片，以及 `whoami` 面板。
5. 视觉风格：暗色低调条（深色背景 + 灰色文字 + 顶部 1px 边框），与面板边框同色（`#30363D`），等宽字体。

### 各内容的状态栏文案

| 内容 | 左侧 title | `[type]` | 右侧滚动百分比 |
|------|-----------|----------|----------------|
| `cat about.md` | `about.md` | `[markdown]` | 显示（`Top`/`NN%`/`Bot`） |
| `cat avatar.png` | `avatar.png` | `[png]` | 不显示 |
| `whoami` | `whoami` | `[profile]` | 不显示 |

- 图片的 `type` 为无点扩展名（`png` / `jpg` / `gif` / `webp` / `svg` / `bmp` / `ico`）。
- 滚动百分比用 vim 惯例：滚动到顶部 `Top`，到底部 `Bot`，中间 `NN%`。

## 方案

采用「结构化 richContent 状态」方案（方案 A）：

- 把 `richContent` 从 `ReactNode | null` 改为携带元信息的结构。
- 状态栏渲染逻辑集中在 `Terminal.tsx` 一处。

### 数据流

1. `src/types.ts` 新增：

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

2. `CommandContext.setRichContent` 签名从 `(node: ReactNode | null) => void` 改为 `(node: ReactNode | null, meta?: RichContentMeta) => void`。

3. `useTerminal.ts` 中 `TerminalState.richContent` 从 `ReactNode | null` 改为 `RichContent | null`；`setRichContent` 实现对应更新：传 `null` 时清空，否则存 `{ node, meta }`（`meta` 缺省时给空字符串兜底，避免类型断言）。

4. 命令调用点改动（`src/commands/builtins/cat.ts`、`whoami.ts`）：

- `cat` 图片：`setRichContent(<img …>, { title: target, type: ext })`
- `cat` md loading：`setRichContent(<loading div>, { title: target, type: 'markdown' })`
- `cat` md 完成：`setRichContent(<MarkdownView …>, { title: target, type: 'markdown' })`
- `whoami`：`setRichContent(<WhoamiPanel />, { title: 'whoami', type: 'profile' })`

其中图片 `ext` 取 `target.slice(target.lastIndexOf('.') + 1).toLowerCase()`。

### UI 结构（`Terminal.tsx`）

`.terminal-rich` 面板由当前的 `[.terminal-rich-body]` 扩展为：

```
.terminal-rich
  .terminal-rich-body   (现有内容，flex:1, overflow-y:auto)
  .terminal-rich-status (新增 footer)
    .status-left   → title + [type]
    .status-right  → 百分比（仅 markdown）
```

状态栏 footer 不随内容滚动（固定在面板底部，`flex-shrink: 0`）。

### 滚动追踪

- `.terminal-rich-body` 上挂 `onScroll`，用 `scrollTop / (scrollHeight - clientHeight)` 计算百分比；当内容不可滚动（`scrollHeight <= clientHeight`）时显示 `Top`。
- 用 React state 存百分比；richContent 变化时（切换文件）用一个 `useEffect` 把 `richBodyRef.current.scrollTop` 重置为 0 并把百分比归零为 `Top`。
- 百分比仅在 `meta.type === 'markdown'` 时渲染。

### 错误处理

- `meta` 缺省（若未来有命令只传 node）时：title/type 为空字符串，状态栏仍正常渲染（不抛错）。
- 清空 `setRichContent(null)` 时整个 `.terminal-rich` 面板卸载，状态栏随之消失。

## 非目标

- 不实现「修改状态」、行列号（只读预览无此概念）。
- 不改动 markdown 渲染逻辑、whoami 面板内容。
- 不新增命令或文件系统改动。

## 测试

- 现有 `src/__tests__/` 若涉及 `setRichContent` 调用，需同步更新签名。
- 手动验证：`cat about.md`（显示 `about.md [markdown]` + 滚动百分比）、`cat 图片`（显示文件名 + `[ext]`，无百分比）、`whoami`（显示 `whoami [profile]`）、`clear`/切文件后状态栏正确消失/重置。
