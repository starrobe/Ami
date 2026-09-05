# 搜索面板（palette）— 设计文档

日期：2026-09-05
分支：`feat/search`

## 目标

移除 `grep` 命令，换成 VSCode 命令面板风格的交互式搜索面板：一个入口（`palette` 命令 + `Ctrl+P`），顶部 tab 在三个模式间切换——**博客列表**、**内容搜索**、**tag 浏览**。选中博客后按 Enter 直接以 rich content（复用现有 `cat` 的 Markdown 渲染）打开。核心是补上「面板内交互（键盘选择 + 文本输入）」这一当前缺失的能力。

## 需求（已确认决策）

| # | 决策 | 说明 |
|---|------|------|
| 1 | 单面板 + 模式切换 | 一个 `palette` 命令，面板顶部 tab 在「博客 / 搜索 / tag」间切换，非三个独立命令 |
| 2 | 入口 | `palette` 命令 + `Ctrl+P` 快捷键（`Ctrl+P` 当前未被占用） |
| 3 | 打开语义 | 选中博客 Enter = spawn `MarkdownView` 面板替换 palette（复用 `cat` 渲染），非打印到终端 |
| 4 | 移除 grep | 删除 `grep` 命令及其在注册表/补全/README 的所有引用 |
| 5 | 搜索范围 | 只搜 `blog/` 下的 `.md`（与「博客」主题一致） |
| 6 | 列表显示 | 显示 frontmatter `title`，缺省回退文件名 |
| 7 | 搜索匹配 | 大小写不敏感子串，匹配 title + 文件内容 |
| 8 | 搜索输入 | 面板内真正的 `<input>`（自动聚焦），非终端 onData（面板打开时 onData 已被屏蔽） |

## 核心概念

- **Palette 是自带状态和键盘处理的 React 组件**：塞进现有 `RichContent.node`，通过 `window keydown`（capture）接管自身按键。
- **`interactive` 标记**：`RichContentMeta` 新增 `interactive?: boolean`。当它置真时，`Terminal.tsx` 现有的全局 keydown 监听（`q/Esc/G/gg/j/k` 滚动键）跳过，把按键让给 Palette。
- **打开 = 面板替换**：Palette 的 `onOpen(path)` 回调先 `SIGTERM` 自己，再 spawn `MarkdownView` 面板。复用现有进程模型（`spawn` 会 `SIGSTOP` 旧前台；先终止 palette 再 spawn 即可，避免留一个 stopped 的 palette 后台 job）。

## 目录结构（新增/修改）

```
src/
├── fs/
│   └── blogIndex.ts          # 新增：纯函数数据层
├── components/
│   ├── Palette.tsx           # 新增：交互组件
│   └── Palette.css           # 新增：样式
├── commands/
│   ├── builtins/
│   │   ├── palette.ts        # 新增：palette 命令
│   │   ├── grep.ts           # 删除
│   │   └── cat.ts            # 修改：抽出「打开 markdown 面板」为共享 helper
│   ├── register.ts           # 修改：去 grep、加 palette
│   └── descriptions.ts       # 修改：同步 names/descriptions/flags/fileArgCommands
├── terminal/
│   ├── input.ts              # 修改：加 Ctrl+P（\x10）分支
│   ├── useTerminal.ts        # 修改：提供 openPalette；抽出共享 markdown helper 的接线
│   └── Terminal.tsx          # 修改：keydown 监听按 interactive gate
└── types.ts                  # 修改：RichContentMeta.interactive、BlogInfo 类型
```

## 数据模型

### `src/fs/blogIndex.ts`（纯函数，无 React 依赖）

```ts
export interface BlogInfo {
  path: string;      // 绝对路径，如 /home/user/blog/algorithm-learning-001-bitwise.md
  title: string;     // frontmatter title，缺省为文件名
  tags: string[];    // frontmatter tags（逗号拆分、trim、小写）
  content: string;   // 原始文件内容（含 frontmatter，用于 searchBlogs）
}

export function parseFrontmatter(content: string): { title?: string; tags: string[] };
export function listBlogs(fs: DirNode): BlogInfo[];        // 递归枚举 /home/user/blog/**/*.md
export function listTags(blogs: BlogInfo[]): string[];     // 去重排序
export function searchBlogs(blogs: BlogInfo[], query: string): BlogInfo[]; // 大小写不敏感子串，匹配 title+content
```

- `parseFrontmatter` 从 `grep.ts` 的 `parseTags` 与 `cat.ts` 的内联正则中抽取共用。
- `listBlogs` 遍历 `/home/user/blog` 子树，过滤 `.md`，递归进入子目录（当前无子目录，但预留）。
- 匹配用 `toLowerCase().includes()`，与旧 grep 的「转义字面量子串」效果一致。

### `src/components/Palette.tsx`

```ts
interface PaletteProps {
  blogs: BlogInfo[];        // 由命令一次性算好传入（fs 静态）
  onOpen: (path: string) => void;
}
```

内部状态：

```ts
type Mode = 'blogs' | 'search' | 'tags';
// mode、selected(当前高亮下标)、query(搜索输入)、tag(下钻选中的 tag，null=还在 tag 列表层)
```

渲染结构：

```
┌─ [博客] [搜索] [tag] ────────────────┐
│  (search 模式才有) <input autofocus> │
│  ── 列表 ──────────────────────────── │
│    ▸ 排序            /blog/xxx.md     │
│      二分搜索          /blog/yyy.md   │
│      ...                             │
└─ 状态栏：palette [search] · hint ────┘
```

- 列表项显示 `title` + 淡化路径；当前选中项高亮。
- tag 模式两级：顶层列出所有 tag，Enter 进入该 tag 的博客列表（`selected` 重置、`tag` 置为选中 tag）；再 Enter 打开；Esc 返回 tag 层。

### `src/commands/builtins/palette.ts`

```ts
export const paletteCommand: CommandHandler = (ctx) => {
  const blogs = listBlogs(ctx.fs);
  let proc: PanelProcess;
  const onOpen = (path: string) => {
    const blog = blogs.find((b) => b.path === path);
    if (!blog) return;
    ctx.manager.signal(proc.pid, 'SIGTERM');          // 先清掉 palette（前台归空）
    openMarkdownPanel(ctx, `cat ${path}`, blog.title, blog.content); // 再 spawn 博客面板（成为前台）
  };
  proc = ctx.spawnPanel('palette', {
    node: React.createElement(Palette, { blogs, onOpen }),
    meta: { title: 'palette', type: 'palette', interactive: true },
  });
  return '';
};
```

- `onOpen` 在用户交互时才调用，`proc` 闭包引用晚绑定安全。
- 终止顺序：先 `SIGTERM` palette（`foregroundPid` 归 null）再 spawn，避免 `spawn` 把 palette 挂成 stopped 后台 job。

### 共享 helper：`openMarkdownPanel`

新建 `src/commands/openMarkdown.ts`，从 `cat.ts` 抽出「打开 `.md` 为 MarkdownView 面板」逻辑（剥 frontmatter → loading 占位 → 懒加载 `MarkdownView` → `setView`），供 `cat` 与 `palette` 复用：

```ts
export function openMarkdownPanel(
  ctx: CommandContext,
  name: string,        // 进程名，如 `cat /home/user/blog/xxx.md`
  title: string,       // 面板标题
  rawContent: string   // 原始文件内容，内部剥 frontmatter
): PanelProcess;
```

`cat.ts` 的 `.md` 分支改为调用它。

## 交互与快捷键（Palette 内）

| 键 | 行为 |
|---|---|
| `↑` / `↓` | 移动选择（越界环绕或夹紧，取夹紧） |
| `Enter` | blogs/search：打开选中博客；tags 第一层：进入该 tag；tags 第二层：打开 |
| `Esc` | tags 第二层：返回 tag 层；否则关闭面板（SIGTERM） |
| `Tab` 或 `1/2/3` | 切换模式（进入 search 时聚焦 input，离开时清 query） |
| 字符输入 | 仅 search 模式：写入 input 实时过滤，`selected` 重置到 0 |

- 键盘监听挂 `window keydown`（`{ capture: true }`），Palette 挂载时加、卸载时移除。
- 需 `preventDefault()` 拦截 `↑/↓/Tab/Esc`，避免焦点/滚动副作用。
- 空结果（search 无匹配）显示「无结果」占位，仍可用 Esc 退出。

## 终端集成

### `Terminal.tsx` keydown gate

现有面板滚动键监听器开头加：

```ts
if (richContent?.meta.interactive) return; // 交给 Palette 自己处理按键
```

其余（非 interactive 面板）行为不变。

### `useTerminal.ts`

- 抽一个 `openPalette`（复用 palette 命令逻辑，直接构造 ctx 调用，**不进 history、不回显 prompt**）。
- 传给 `createInputHandler` 作为新 dep，供 `\x10`（Ctrl+P）触发。

### `input.ts`

在「面板打开时的 early return」之后加：

```ts
if (data === '\x10') { openPalette(); return; }
```

（面板打开时 `\x10` 会被顶部 guard 拦下，符合「已有面板时不另开面板」预期。）

### `Ctrl+P` 与 history 的关系

`Ctrl+P` 直接走 `openPalette`，不写 history、不回显。`palette` 命令本身仍走正常命令流程（进 history）。

## 移除 grep 的改动面

- 删 `src/commands/builtins/grep.ts`。
- `register.ts`：删 import + `registry.register('grep', ...)`；加 palette。
- `descriptions.ts`：`commandNames`、`commandDescriptions`、`commandFlags`、`fileArgCommands` 去 grep、加 palette。
- `README.md`：Commands 表删 grep 行、加 palette 行；Features 补一句面板交互。
- `help.ts` 的快捷键区补 `Ctrl+P`（可选）。

## 错误处理与边界

- search 空结果 → 显示「无结果」，不崩溃，Esc 可退。
- 选中项越界（过滤后列表变短）→ `selected` 夹紧到 `[0, len-1]`。
- 打开博客时 Markdown 懒加载失败 → 走现有 `ErrorBoundary` 回退（已有机制）。
- 连续打开多个博客：每次都是「终止 palette → spawn 新面板」，旧博客面板按 spawn 规则挂后台，可 `jobs`/`fg` 找回（沿用现有进程模型，无需新逻辑）。

## 非目标

- 不做全盘 grep（只搜 `blog/`）。
- 不做「打开后跳转到匹配行/高亮匹配词」。
- 不做搜索高亮、正则、`-v/-c` 等 grep 选项扩展。
- 不做 blogs/tags 模式的额外过滤输入（YAGNI，未来可加）。
- 不做持久化（面板状态纯内存）。

## 测试

纯逻辑单测（Vitest）：

- `blogIndex.test.ts`：`parseFrontmatter`（有/无 frontmatter、单/多 tag、title 缺失回退）、`listBlogs`（枚举 `.md`、跳过非 md、递归子目录）、`listTags`（去重排序）、`searchBlogs`（大小写不敏感、匹配 title 与 content、无匹配返回空）。
- 现有 57 测试 + lint + build 保持绿。
