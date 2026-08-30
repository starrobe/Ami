# 进程管理（Jobs）子系统 — 设计文档

日期：2026-08-30
分支：`feat/jobs-management`

## 目标

为 Ami Terminal 引入一套**完整进程模拟**的作业控制（job control）子系统：进程有 PID、可收信号（SIGSTOP/SIGCONT/SIGTERM/SIGKILL）、有前台/后台之分；用户可用 `jobs`/`fg`/`bg`/`kill`/`ps` 管理进程，用 `Ctrl+Z` 挂起前台。核心场景是把 rich content 面板（`cat`/`whoami`）当作进程：关闭时挂到后台，随时重新唤起；并为未来新增进程类型预留同一套接口。

## 需求（已确认决策）

| # | 决策 | 说明 |
|---|------|------|
| 1 | 完整进程模拟 | PID、信号、fg/bg/kill |
| 2 | 后台行为由进程实现决定 | 框架统一处理前台/后台与状态；进程通过钩子自行定义 running/stopped 语义——有的后台继续执行，有的仅隐藏 |
| 3 | 完整信号机制 | SIGSTOP/SIGCONT/SIGTERM/SIGKILL，job 有信号处理器，fg/bg/kill 内部走信号 |
| 4 | 扁平进程表 + 预留 PPID | 当前无 fork/exec，PPID 恒为 0，为未来树形升级留口 |
| 5 | 命令面 | `jobs`/`fg`/`bg`/`kill`/`ps` + `Ctrl+Z` |
| 6 | 关闭语义 | 关闭面板 = SIGSTOP 挂后台（保留在 jobs），`kill` 才终止 |
| 7 | 独立 process 子系统 | 纯 TS 核心 + React 桥接 |
| 8 | Ctrl+C | SIGTERM 终止前台（对齐真实 shell 的 SIGINT） |
| 9 | Ctrl+L | 只清屏，不动 job |

## 核心概念

- **进程（Process）**：最小单元，有 `pid`、`ppid`、`state`（running/stopped/terminated）、`name`。
- **前台/后台**：终端同一时刻至多一个**前台进程**（其 `view()` 被渲染）。后台进程不渲染，但保留在进程表。
- **后台行为由进程实现决定**：框架只负责状态机（running/stopped/terminated）、信号分发与前台/后台指针。一个进程「running」具体意味着什么（后台继续执行 vs 仅处于可显示状态）由实现通过 `onStop`/`onContinue`/`onTerminate` 钩子自行定义。**manager 不感知进程内部运行逻辑**——它只发信号、管前台指针。

## 目录结构（新增）

```
src/process/
├── signals.ts        # Signal 类型
├── process.ts        # Process 接口 + ProcessState + BaseProcess 抽象基类
├── manager.ts        # createProcessManager() 工厂函数
└── panelProcess.ts   # PanelProcess —— 富内容面板进程（当前唯一实现）
```

未来新功能 = 新增一个实现 `Process` 接口的文件，不改现有文件。

## 数据模型

### `signals.ts`

```ts
export type Signal = 'SIGSTOP' | 'SIGCONT' | 'SIGTERM' | 'SIGKILL';
```

### `process.ts`

```ts
import type { ReactNode } from 'react';   // 仅类型导入，运行时无 React 依赖
import type { RichContent } from '../types';

export type ProcessState = 'running' | 'stopped' | 'terminated';

export interface Process {
  readonly pid: number;
  readonly ppid: number;       // 预留，当前恒为 0
  readonly name: string;       // 命令名：cat / whoami / ...
  state: ProcessState;
  view(): RichContent | null;  // 前台渲染；无可视输出的进程返回 null
  signal(sig: Signal): void;   // 信号处理 = 生命周期钩子
}
```

`view()` 返回 `RichContent | null`（复用 `types.ts` 现有 `RichContent = { node, meta }`），因状态栏需渲染 `meta.title`/`meta.type`。

`BaseProcess` 抽象基类提供默认状态机，子类只覆写钩子：

```ts
export abstract class BaseProcess implements Process {
  state: ProcessState = 'running';
  signal(sig: Signal) {
    if (this.state === 'terminated') return;          // 终止后信号为 no-op
    switch (sig) {
      case 'SIGSTOP': if (this.state === 'running') { this.state = 'stopped'; this.onStop(); } break;
      case 'SIGCONT': if (this.state === 'stopped') { this.state = 'running'; this.onContinue(); } break;
      case 'SIGTERM': this.state = 'terminated'; this.onTerminate(false); break;
      case 'SIGKILL': this.state = 'terminated'; this.onTerminate(true);  break;
    }
  }
  protected onStop() {}
  protected onContinue() {}
  protected onTerminate(_forced: boolean) {}
  abstract view(): RichContent | null;
}
```

### `manager.ts` — `createProcessManager()`

工厂函数风格，与现有 `createRegistry()` / `createInitialFS()` 一致：

```ts
export interface ProcessManager {
  spawn(name: string, build: (pid: number, notify: () => void) => Process): Process;
  signal(pid: number, sig: Signal): void;
  fg(ref: string): string | null;      // "%n" 或裸 pid；错误返回消息字符串
  bg(ref: string): string | null;
  list(): Process[];                    // ps：全部进程
  jobs(): Process[];                    // 后台进程（按 spawn 顺序）
  getForeground(): Process | null;
  subscribe(fn: () => void): () => void; // React 桥接：状态变更时重渲染
}
```

内部：`Map<pid, Process>` + `pidCounter` + `foregroundPid` + `listeners` 集合。

## 信号分发副作用

| 信号 | 管理器额外动作 |
|---|---|
| `SIGSTOP` | 若目标是前台 → `foregroundPid = null`（交还前台，面板隐藏） |
| `SIGCONT` | 只改进程状态，**不动前台**（前台归属由 fg/bg 决定） |
| `SIGTERM`/`SIGKILL` | 从 `Map` 删除；若前台 → 清空前台 |

每次变更后 `emit()` 通知 React。

## fg / bg / spawn 语义

- `fg %n`：若 stopped 先发 `SIGCONT` → 再 `foregroundPid = pid`。
- `bg %n`：若 stopped 先发 `SIGCONT` → 若它是前台则 `foregroundPid = null`。
- `spawn`：pid 自增、登记、设为前台；**若已有前台进程 → 先对其发 `SIGSTOP`**（旧面板自动挂到后台）。

### `%n` 解析

`%n` = `jobs()` 列表（spawn 顺序）第 n 个；`fg`/`bg`/`kill` 同时接受 `%n` 或裸 pid。（简化：jobs 表用索引而非 bash 的稳定作业号，索引随终止位移。）

## 进程种类

### `PanelProcess`（当前唯一实现）

- 继承 `BaseProcess` 默认状态机。
- `view()` 返回面板内容（Markdown / 图片 / whoami）。
- 无连续工作：后台 `stopped` 状态 =「隐藏待恢复」。
- view 可变：`cat` 的 markdown 懒加载（先 `Loading...` 占位，异步替换成 `MarkdownView`），故暴露 `setView(rich)` 并调 `notify()`。

### 扩展方式

新进程类型只需实现 `Process` 接口（或继承 `BaseProcess` 覆写钩子）：`signal` 各信号下的行为由实现自行定义（例如后台 `running` 时维持异步工作），`view()` 返回前台呈现或 `null`。框架不对具体进程类型做任何假设——任何未来功能，都是一个新的 `Process` 实现。

## 终端与命令集成

### `CommandContext`（`types.ts`）

- 删除 `setRichContent`。
- 新增 `manager: ProcessManager` + 便捷方法 `spawnPanel(name, rich): Process`（内部 `manager.spawn` + `new PanelProcess`）。

### `useTerminal.ts`

- `processManagerRef = useRef(createProcessManager())`；`subscribe(forceRender)` 订阅重渲染。
- 删除 `state.richContent`；前台视图 = `pm.getForeground()?.view() ?? null`。
- 新增 `suspendForeground()`（= `signal(fgPid, 'SIGSTOP')`）与 `Ctrl+Z` 键处理。

### `Terminal.tsx`

- 渲染 `manager.getForeground()?.view()` 而非 `state.richContent`。
- 背景点击 → `signal(foreground.pid, 'SIGSTOP')`（关闭=挂起）。

### 触发点映射

| 触发 | 动作 |
|---|---|
| 背景点击 / ESC | `SIGSTOP` 前台 → 挂后台 |
| `Ctrl+Z`（新增） | `SIGSTOP` 前台 → 挂后台 |
| 运行其他命令（除 `clear`） | 先 `SIGSTOP` 当前前台 |
| `cat`/`whoami` 再 spawn | 旧前台自动 `SIGSTOP`（spawn 规则） |
| `clear` 命令 | 只清屏，不动 job（与 `Ctrl+L` 一致） |
| `Ctrl+C` | `SIGTERM` 前台（终止） |
| `Ctrl+L` | 只清屏，不动 job |
| `kill` / `kill -9` | `SIGTERM` / `SIGKILL`（终止） |

## 新命令行为

- `jobs` → `[1]+  Stopped   cat foo.md`（`+`=最近，`-`=次近；`Stopped`/`Running`）
- `fg [%n]` → 默认最近 job；`SIGCONT` + 设前台
- `bg [%n]` → `SIGCONT` + 退前台
- `kill [-9] <pid|%n>` → 默认 `SIGTERM`，`-9` 为 `SIGKILL`
- `ps` → `PID  PPID  STATE  NAME` 表格

## 错误处理与边界

- 无 job 时 `fg`/`bg`/`jobs` → `fg: no jobs` / `jobs: no jobs`
- 无效引用 → `fg: %99: no such job` / `kill: (999) - No such process`
- 对已终止进程发信号 → no-op（`BaseProcess` 守卫）
- `SIGKILL` 跳过清理钩子；`SIGTERM` 走优雅清理
- 连续 `cat` 多文件 → 依次挂后台，`jobs` 按 spawn 顺序列出，`fg %1` 恢复最早那个

## 非目标

- 不跨刷新持久化（纯内存）。
- 不做真实 fork/exec（PPID 仅为预留字段）。
- 不实现 SIGINT/SIGHUP 等其余信号（当前仅 4 个）。
- 本次不实现任何新的具体进程类型（音乐等仅为未来扩展方向，非本次范围）。

## 测试

纯逻辑单测（Vitest，无 React）：

- `BaseProcess` 状态机：各信号转移、`terminated` 后 no-op、KILL vs TERM 清理差异。
- `createProcessManager`：spawn 前台抢占、`SIGSTOP` 交还前台、`fg`/`bg` 前台指针、`%n` 解析、`SIGTERM/KILL` 移除。
- 现有 `parser.test.ts` / `columnLayout.test.ts` 不受影响。
