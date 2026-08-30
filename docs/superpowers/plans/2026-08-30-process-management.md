# Process Management (Jobs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shell-style process/job-control subsystem to Ami Terminal: processes with PIDs and signals, `jobs`/`fg`/`bg`/`kill`/`ps` commands, `Ctrl+Z`/`Ctrl+C`/`Ctrl+L` key handling, and rich-content panels that suspend to the background on close and can be re-summoned.

**Architecture:** A standalone `src/process/` module holds pure, React-free process logic (Signal type, `BaseProcess` state machine, `createProcessManager`). `PanelProcess` implements the process interface for rich-content panels. `useTerminal` owns a manager instance, subscribes for re-renders, and exposes it to `Terminal.tsx`; commands interact through `CommandContext.manager` / `spawnPanel`.

**Tech Stack:** TypeScript 7, React 19, Vitest 4, oxlint. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-30-process-management-design.md`

## Global Constraints

- Signal set is exactly 4: `SIGSTOP` | `SIGCONT` | `SIGTERM` | `SIGKILL` (no SIGINT).
- Flat process table: `ppid` is always `0` (reserved, not used).
- In-memory only; no persistence across refresh.
- New files go under `src/process/`.
- Factory-function style (`createProcessManager`) matching existing `createRegistry()` / `createInitialFS()`.
- Tests live in `src/__tests__/*.test.ts`, Vitest, no React rendering.
- `CommandHandler` returns `string | void` (use `undefined` for "no output", not `null`).
- Each task ends with `npm test` green and `npm run build` green (type-check) before commit.

---

### Task 1: Signal type + Process interface + BaseProcess state machine

**Files:**
- Create: `src/process/signals.ts`
- Create: `src/process/process.ts`
- Test: `src/__tests__/process.test.ts`

**Interfaces:**
- Consumes: `RichContent` from `src/types.ts` (type-only).
- Produces: `Signal` type; `ProcessState` type; `Process` interface; `BaseProcess` abstract class (with `signal()`, `view()`, and protected `onStop`/`onContinue`/`onTerminate` hooks).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/process.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BaseProcess } from '../process/process';

class SpyProcess extends BaseProcess {
  events: string[] = [];
  view() { return null; }
  protected onStop() { this.events.push('stop'); }
  protected onContinue() { this.events.push('continue'); }
  protected onTerminate(forced: boolean) { this.events.push(forced ? 'kill' : 'term'); }
}

const make = () => new SpyProcess(1, 0, 'test');

describe('BaseProcess state machine', () => {
  it('starts running', () => {
    expect(make().state).toBe('running');
  });

  it('SIGSTOP stops a running process', () => {
    const p = make();
    p.signal('SIGSTOP');
    expect(p.state).toBe('stopped');
    expect(p.events).toEqual(['stop']);
  });

  it('SIGSTOP on a stopped process is a no-op', () => {
    const p = make();
    p.signal('SIGSTOP');
    p.signal('SIGSTOP');
    expect(p.events).toEqual(['stop']);
  });

  it('SIGCONT resumes a stopped process', () => {
    const p = make();
    p.signal('SIGSTOP');
    p.signal('SIGCONT');
    expect(p.state).toBe('running');
    expect(p.events).toEqual(['stop', 'continue']);
  });

  it('SIGCONT on a running process is a no-op', () => {
    const p = make();
    p.signal('SIGCONT');
    expect(p.events).toEqual([]);
  });

  it('SIGTERM terminates gracefully', () => {
    const p = make();
    p.signal('SIGTERM');
    expect(p.state).toBe('terminated');
    expect(p.events).toEqual(['term']);
  });

  it('SIGKILL terminates forcefully', () => {
    const p = make();
    p.signal('SIGKILL');
    expect(p.state).toBe('terminated');
    expect(p.events).toEqual(['kill']);
  });

  it('signals after termination are no-ops', () => {
    const p = make();
    p.signal('SIGKILL');
    p.signal('SIGCONT');
    p.signal('SIGSTOP');
    expect(p.events).toEqual(['kill']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/process.test.ts`
Expected: FAIL — cannot resolve `../process/process`.

- [ ] **Step 3: Write the implementation**

Create `src/process/signals.ts`:

```ts
export type Signal = 'SIGSTOP' | 'SIGCONT' | 'SIGTERM' | 'SIGKILL';
```

Create `src/process/process.ts`:

```ts
import type { RichContent } from '../types';
import type { Signal } from './signals';

export type ProcessState = 'running' | 'stopped' | 'terminated';

export interface Process {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  state: ProcessState;
  view(): RichContent | null;
  signal(sig: Signal): void;
}

export abstract class BaseProcess implements Process {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  state: ProcessState = 'running';

  constructor(pid: number, ppid: number, name: string) {
    this.pid = pid;
    this.ppid = ppid;
    this.name = name;
  }

  signal(sig: Signal): void {
    if (this.state === 'terminated') return;
    switch (sig) {
      case 'SIGSTOP':
        if (this.state === 'running') {
          this.state = 'stopped';
          this.onStop();
        }
        break;
      case 'SIGCONT':
        if (this.state === 'stopped') {
          this.state = 'running';
          this.onContinue();
        }
        break;
      case 'SIGTERM':
        this.state = 'terminated';
        this.onTerminate(false);
        break;
      case 'SIGKILL':
        this.state = 'terminated';
        this.onTerminate(true);
        break;
    }
  }

  protected onStop(): void {}
  protected onContinue(): void {}
  protected onTerminate(_forced: boolean): void {}

  abstract view(): RichContent | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/process.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/process/signals.ts src/process/process.ts src/__tests__/process.test.ts
git commit -m "feat(process): add Signal type and BaseProcess state machine"
```

---

### Task 2: Process manager (spawn / signal / fg / bg / jobs)

**Files:**
- Create: `src/process/manager.ts`
- Test: `src/__tests__/manager.test.ts`

**Interfaces:**
- Consumes: `Signal` (from `signals.ts`), `Process` (from `process.ts`).
- Produces: `ProcessManager` interface and `createProcessManager()` factory. Methods: `spawn(build)`, `signal(pid, sig)`, `resolve(ref)`, `fg(ref?)`, `bg(ref?)`, `list()`, `jobs()`, `getForeground()`, `subscribe(fn)`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/manager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createProcessManager } from '../process/manager';
import { BaseProcess } from '../process/process';

class SpyProcess extends BaseProcess {
  events: string[] = [];
  view() { return null; }
  protected onStop() { this.events.push('stop'); }
  protected onContinue() { this.events.push('continue'); }
  protected onTerminate(f: boolean) { this.events.push(f ? 'kill' : 'term'); }
}

const makeProcess = (pid: number) => new SpyProcess(pid, 0, `p${pid}`);

describe('createProcessManager', () => {
  it('spawn assigns sequential pids and sets foreground', () => {
    const pm = createProcessManager();
    const p1 = pm.spawn((pid) => makeProcess(pid));
    const p2 = pm.spawn((pid) => makeProcess(pid));
    expect(p1.pid).toBe(1);
    expect(p2.pid).toBe(2);
    expect(pm.getForeground()).toBe(p2);
  });

  it('spawn suspends the current foreground', () => {
    const pm = createProcessManager();
    const p1 = pm.spawn((pid) => makeProcess(pid));
    pm.spawn((pid) => makeProcess(pid));
    expect(p1.state).toBe('stopped');
    expect(p1.events).toEqual(['stop']);
  });

  it('SIGSTOP on foreground clears foreground', () => {
    const pm = createProcessManager();
    const p = pm.spawn((pid) => makeProcess(pid));
    pm.signal(p.pid, 'SIGSTOP');
    expect(pm.getForeground()).toBeNull();
    expect(p.state).toBe('stopped');
  });

  it('SIGCONT does not change foreground', () => {
    const pm = createProcessManager();
    const p = pm.spawn((pid) => makeProcess(pid));
    pm.signal(p.pid, 'SIGSTOP');
    pm.signal(p.pid, 'SIGCONT');
    expect(pm.getForeground()).toBeNull();
    expect(p.state).toBe('running');
  });

  it('SIGTERM removes the process and clears foreground', () => {
    const pm = createProcessManager();
    const p = pm.spawn((pid) => makeProcess(pid));
    pm.signal(p.pid, 'SIGTERM');
    expect(pm.list()).toEqual([]);
    expect(pm.getForeground()).toBeNull();
  });

  it('fg resumes a stopped job and sets it foreground', () => {
    const pm = createProcessManager();
    const p = pm.spawn((pid) => makeProcess(pid));
    pm.signal(p.pid, 'SIGSTOP');
    expect(pm.fg('%1')).toBeNull();
    expect(p.state).toBe('running');
    expect(pm.getForeground()).toBe(p);
  });

  it('bg resumes a stopped job and keeps it background', () => {
    const pm = createProcessManager();
    const p = pm.spawn((pid) => makeProcess(pid));
    pm.signal(p.pid, 'SIGSTOP');
    expect(pm.bg('%1')).toBeNull();
    expect(p.state).toBe('running');
    expect(pm.getForeground()).toBeNull();
  });

  it('fg with no jobs returns an error', () => {
    const pm = createProcessManager();
    expect(pm.fg()).toBe('fg: no jobs');
  });

  it('fg with an invalid ref returns an error', () => {
    const pm = createProcessManager();
    pm.spawn((pid) => makeProcess(pid));
    expect(pm.fg('%9')).toBe('fg: %9: no such job');
  });

  it('%n resolves jobs in spawn order', () => {
    const pm = createProcessManager();
    const p1 = pm.spawn((pid) => makeProcess(pid));
    const p2 = pm.spawn((pid) => makeProcess(pid));
    expect(pm.jobs()).toEqual([p1]);
    expect(pm.resolve('%1')).toBe(p1);
    expect(pm.resolve('2')).toBe(p2);
  });

  it('subscribe notifies on changes and unsubscribe stops it', () => {
    const pm = createProcessManager();
    let count = 0;
    const unsub = pm.subscribe(() => count++);
    pm.spawn((pid) => makeProcess(pid));
    expect(count).toBe(1);
    unsub();
    pm.spawn((pid) => makeProcess(pid));
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/manager.test.ts`
Expected: FAIL — cannot resolve `../process/manager`.

- [ ] **Step 3: Write the implementation**

Create `src/process/manager.ts`:

```ts
import type { Signal } from './signals';
import type { Process } from './process';

export interface ProcessManager {
  spawn(build: (pid: number, notify: () => void) => Process): Process;
  signal(pid: number, sig: Signal): void;
  resolve(ref: string): Process | null;
  fg(ref?: string): string | null;
  bg(ref?: string): string | null;
  list(): Process[];
  jobs(): Process[];
  getForeground(): Process | null;
  subscribe(fn: () => void): () => void;
}

export function createProcessManager(): ProcessManager {
  const processes = new Map<number, Process>();
  let pidCounter = 1;
  let foregroundPid: number | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const fn of listeners) fn();
  };

  const backgroundJobs = (): Process[] =>
    [...processes.values()].filter((p) => p.pid !== foregroundPid);

  const resolve = (ref: string): Process | null => {
    if (ref.startsWith('%')) {
      const n = Number.parseInt(ref.slice(1), 10);
      if (Number.isNaN(n)) return null;
      return backgroundJobs()[n - 1] ?? null;
    }
    const pid = Number.parseInt(ref, 10);
    if (Number.isNaN(pid)) return null;
    return processes.get(pid) ?? null;
  };

  const mostRecent = (): Process | null => {
    const jobs = backgroundJobs();
    return jobs[jobs.length - 1] ?? null;
  };

  return {
    spawn(build) {
      if (foregroundPid !== null) {
        processes.get(foregroundPid)?.signal('SIGSTOP');
      }
      const pid = pidCounter++;
      const proc = build(pid, emit);
      processes.set(pid, proc);
      foregroundPid = pid;
      emit();
      return proc;
    },

    signal(pid, sig) {
      const proc = processes.get(pid);
      if (!proc || proc.state === 'terminated') return;
      proc.signal(sig);
      if (sig === 'SIGSTOP' && foregroundPid === pid) {
        foregroundPid = null;
      } else if (sig === 'SIGTERM' || sig === 'SIGKILL') {
        processes.delete(pid);
        if (foregroundPid === pid) foregroundPid = null;
      }
      emit();
    },

    resolve,

    fg(ref) {
      let proc: Process | null;
      if (ref) {
        proc = resolve(ref);
        if (!proc) return `fg: ${ref}: no such job`;
      } else {
        proc = mostRecent();
        if (!proc) return 'fg: no jobs';
      }
      if (proc.state === 'stopped') proc.signal('SIGCONT');
      foregroundPid = proc.pid;
      emit();
      return null;
    },

    bg(ref) {
      let proc: Process | null;
      if (ref) {
        proc = resolve(ref);
        if (!proc) return `bg: ${ref}: no such job`;
      } else {
        proc = mostRecent();
        if (!proc) return 'bg: no jobs';
      }
      if (proc.state === 'stopped') proc.signal('SIGCONT');
      if (foregroundPid === proc.pid) foregroundPid = null;
      emit();
      return null;
    },

    list() {
      return [...processes.values()];
    },

    jobs() {
      return backgroundJobs();
    },

    getForeground() {
      return foregroundPid !== null ? processes.get(foregroundPid) ?? null : null;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/manager.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/process/manager.ts src/__tests__/manager.test.ts
git commit -m "feat(process): add process manager (spawn/signal/fg/bg/jobs)"
```

---

### Task 3: PanelProcess

**Files:**
- Create: `src/process/panelProcess.ts`
- Test: `src/__tests__/panelProcess.test.ts`

**Interfaces:**
- Consumes: `RichContent` (type-only from `types.ts`), `BaseProcess` (from `process.ts`).
- Produces: `PanelProcess` class with `view()` returning the stored content and `setView(content)` to replace it and notify.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/panelProcess.test.ts`:

```ts
import React from 'react';
import { describe, it, expect } from 'vitest';
import { PanelProcess } from '../process/panelProcess';
import type { RichContent } from '../types';

const content = (title: string): RichContent => ({
  node: React.createElement('div', null, title),
  meta: { title, type: 'markdown' },
});

describe('PanelProcess', () => {
  it('returns its content from view()', () => {
    const p = new PanelProcess(1, 'cat foo.md', content('foo'), () => {});
    expect(p.view()).toEqual(content('foo'));
  });

  it('setView replaces content and notifies', () => {
    let notified = 0;
    const p = new PanelProcess(1, 'cat foo.md', content('a'), () => { notified++; });
    const next = content('b');
    p.setView(next);
    expect(p.view()).toBe(next);
    expect(notified).toBe(1);
  });

  it('inherits the signal state machine', () => {
    const p = new PanelProcess(1, 'cat foo.md', content('a'), () => {});
    p.signal('SIGSTOP');
    expect(p.state).toBe('stopped');
    p.signal('SIGCONT');
    expect(p.state).toBe('running');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panelProcess.test.ts`
Expected: FAIL — cannot resolve `../process/panelProcess`.

- [ ] **Step 3: Write the implementation**

Create `src/process/panelProcess.ts`:

```ts
import type { RichContent } from '../types';
import { BaseProcess } from './process';

export class PanelProcess extends BaseProcess {
  private content: RichContent;
  private notify: () => void;

  constructor(pid: number, name: string, content: RichContent, notify: () => void) {
    super(pid, 0, name);
    this.content = content;
    this.notify = notify;
  }

  view(): RichContent | null {
    return this.content;
  }

  setView(content: RichContent): void {
    this.content = content;
    this.notify();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panelProcess.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/process/panelProcess.ts src/__tests__/panelProcess.test.ts
git commit -m "feat(process): add PanelProcess"
```

---

### Task 4: Wire the manager into CommandContext (additive)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/terminal/useTerminal.ts`

**Interfaces:**
- Consumes: `ProcessManager`, `PanelProcess` (from `src/process/`).
- Produces: `CommandContext` gains `manager: ProcessManager` and `spawnPanel: (name, rich) => PanelProcess` (keeps `setRichContent` for now). `useTerminal` creates the manager and supplies both new fields in the command context.

- [ ] **Step 1: Add manager + spawnPanel to CommandContext**

In `src/types.ts`, add imports at the top (after the `ReactNode` import):

```ts
import type { ProcessManager } from './process/manager';
import type { PanelProcess } from './process/panelProcess';
```

Then in the `CommandContext` interface, add two fields (keep `setRichContent` unchanged):

```ts
export interface CommandContext {
  cwd: string;
  fs: DirNode;
  setCwd: (path: string) => void;
  appendOutput: (text: string) => void;
  setRichContent: (node: ReactNode | null, meta?: RichContentMeta) => void;
  manager: ProcessManager;
  spawnPanel: (name: string, rich: RichContent) => PanelProcess;
  theme: string;
  setTheme: (name: string) => void;
  termCols: number;
}
```

- [ ] **Step 2: Wire the manager into useTerminal**

In `src/terminal/useTerminal.ts`:

Add imports after the existing command imports (after the line importing `getTheme`):

```ts
import { createProcessManager } from '../process/manager';
import type { ProcessManager } from '../process/manager';
import { PanelProcess } from '../process/panelProcess';
import type { Process } from '../process/process';
```

Add the manager ref after `const containerRef = useRef<HTMLDivElement | null>(null);`:

```ts
const processManagerRef = useRef<ProcessManager>(createProcessManager());
```

Add the `spawnPanel` callback after the `setTheme` callback definition:

```ts
const spawnPanel = useCallback((name: string, rich: RichContent): Process => {
  return processManagerRef.current.spawn(
    (pid, notify) => new PanelProcess(pid, name, rich, notify)
  );
}, []);
```

In `executeCommand`, add `manager` and `spawnPanel` to the `ctx` object literal (after `setRichContent,`):

```ts
      manager: processManagerRef.current,
      spawnPanel,
```

Add `spawnPanel` to the `executeCommand` dependency array (it is referenced in the ctx).

- [ ] **Step 3: Verify build and tests**

Run: `npm run build` then `npm test`
Expected: build green (type-check passes), all existing tests pass. The new fields are additive; no behavior changes yet.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/terminal/useTerminal.ts
git commit -m "feat(process): wire manager into CommandContext"
```

---

### Task 5: jobs / fg / bg / kill / ps commands

**Files:**
- Create: `src/commands/builtins/jobs.ts`
- Create: `src/commands/builtins/fg.ts`
- Create: `src/commands/builtins/bg.ts`
- Create: `src/commands/builtins/kill.ts`
- Create: `src/commands/builtins/ps.ts`
- Modify: `src/commands/descriptions.ts`
- Modify: `src/terminal/useTerminal.ts`
- Test: `src/__tests__/jobCommands.test.ts`

**Interfaces:**
- Consumes: `CommandContext.manager` (from Task 4), `ProcessManager` (from Task 2), `PanelProcess` (from Task 3).
- Produces: five `CommandHandler` exports (`jobsCommand`, `fgCommand`, `bgCommand`, `killCommand`, `psCommand`), registered in `useTerminal`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/jobCommands.test.ts`:

```ts
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createProcessManager } from '../process/manager';
import type { ProcessManager } from '../process/manager';
import { PanelProcess } from '../process/panelProcess';
import { createInitialFS } from '../fs/filesystem';
import type { CommandContext } from '../types';
import { jobsCommand } from '../commands/builtins/jobs';
import { fgCommand } from '../commands/builtins/fg';
import { bgCommand } from '../commands/builtins/bg';
import { killCommand } from '../commands/builtins/kill';
import { psCommand } from '../commands/builtins/ps';

const content = {
  node: React.createElement('div'),
  meta: { title: 'foo.md', type: 'markdown' },
};

function makeCtx(pm: ProcessManager): CommandContext {
  return {
    cwd: '/home/user',
    fs: createInitialFS(),
    setCwd: () => {},
    appendOutput: () => {},
    setRichContent: () => {},
    manager: pm,
    spawnPanel: () => { throw new Error('unused'); },
    theme: 'default',
    setTheme: () => {},
    termCols: 80,
  };
}

const spawnPanel = (pm: ProcessManager, name: string) =>
  pm.spawn((pid, notify) => new PanelProcess(pid, name, content, notify));

describe('jobsCommand', () => {
  it('lists stopped background jobs', () => {
    const pm = createProcessManager();
    const p = spawnPanel(pm, 'cat foo.md');
    pm.signal(p.pid, 'SIGSTOP');
    const out = jobsCommand(makeCtx(pm), { cmd: 'jobs', args: [], flags: [] });
    expect(out).toContain('cat foo.md');
    expect(out).toContain('Stopped');
    expect(out).toContain('[1]');
  });

  it('reports no jobs when empty', () => {
    const pm = createProcessManager();
    expect(jobsCommand(makeCtx(pm), { cmd: 'jobs', args: [], flags: [] })).toBe('jobs: no jobs\r\n');
  });
});

describe('fgCommand', () => {
  it('brings a stopped job to the foreground', () => {
    const pm = createProcessManager();
    const p = spawnPanel(pm, 'cat foo.md');
    pm.signal(p.pid, 'SIGSTOP');
    expect(fgCommand(makeCtx(pm), { cmd: 'fg', args: ['%1'], flags: [] })).toBeUndefined();
    expect(pm.getForeground()).toBe(p);
  });
});

describe('bgCommand', () => {
  it('resumes a stopped job in the background', () => {
    const pm = createProcessManager();
    const p = spawnPanel(pm, 'cat foo.md');
    pm.signal(p.pid, 'SIGSTOP');
    bgCommand(makeCtx(pm), { cmd: 'bg', args: ['%1'], flags: [] });
    expect(p.state).toBe('running');
    expect(pm.getForeground()).toBeNull();
  });
});

describe('killCommand', () => {
  it('terminates a job by %n', () => {
    const pm = createProcessManager();
    const p = spawnPanel(pm, 'cat foo.md');
    pm.signal(p.pid, 'SIGSTOP');
    killCommand(makeCtx(pm), { cmd: 'kill', args: ['%1'], flags: [] });
    expect(p.state).toBe('terminated');
    expect(pm.list()).toEqual([]);
  });

  it('force-kills with -9', () => {
    const pm = createProcessManager();
    const p = spawnPanel(pm, 'cat foo.md');
    pm.signal(p.pid, 'SIGSTOP');
    killCommand(makeCtx(pm), { cmd: 'kill', args: ['%1'], flags: ['9'] });
    expect(p.state).toBe('terminated');
  });

  it('errors on an unknown pid', () => {
    const pm = createProcessManager();
    const out = killCommand(makeCtx(pm), { cmd: 'kill', args: ['999'], flags: [] });
    expect(out).toContain('No such process');
  });
});

describe('psCommand', () => {
  it('lists all processes with pid and name', () => {
    const pm = createProcessManager();
    spawnPanel(pm, 'cat foo.md');
    const out = psCommand(makeCtx(pm), { cmd: 'ps', args: [], flags: [] });
    expect(out).toContain('cat foo.md');
    expect(out).toContain('PID');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/jobCommands.test.ts`
Expected: FAIL — cannot resolve the five `../commands/builtins/*` modules.

- [ ] **Step 3: Write the command implementations**

Create `src/commands/builtins/jobs.ts`:

```ts
import type { CommandHandler } from '../../types';

export const jobsCommand: CommandHandler = (ctx, _parsed) => {
  const jobs = ctx.manager.jobs();
  if (jobs.length === 0) return 'jobs: no jobs\r\n';

  let output = '';
  jobs.forEach((p, i) => {
    const mark = i === jobs.length - 1 ? '+' : i === jobs.length - 2 ? '-' : ' ';
    const state = p.state === 'stopped' ? 'Stopped' : 'Running';
    output += `[${i + 1}]${mark}  ${state.padEnd(10)}  ${p.name}\r\n`;
  });
  return output;
};
```

Create `src/commands/builtins/fg.ts`:

```ts
import type { CommandHandler } from '../../types';

export const fgCommand: CommandHandler = (ctx, parsed) => {
  return ctx.manager.fg(parsed.args[0]) ?? undefined;
};
```

Create `src/commands/builtins/bg.ts`:

```ts
import type { CommandHandler } from '../../types';

export const bgCommand: CommandHandler = (ctx, parsed) => {
  return ctx.manager.bg(parsed.args[0]) ?? undefined;
};
```

Create `src/commands/builtins/kill.ts`:

```ts
import type { CommandHandler } from '../../types';

export const killCommand: CommandHandler = (ctx, parsed) => {
  const ref = parsed.args[0];
  if (!ref) return 'kill: usage: kill [-9] <pid|%job>\r\n';
  const proc = ctx.manager.resolve(ref);
  if (!proc) return `kill: (${ref}) - No such process\r\n`;
  ctx.manager.signal(proc.pid, parsed.flags.includes('9') ? 'SIGKILL' : 'SIGTERM');
  return undefined;
};
```

Create `src/commands/builtins/ps.ts`:

```ts
import type { CommandHandler } from '../../types';

export const psCommand: CommandHandler = (ctx, _parsed) => {
  const procs = ctx.manager.list();
  if (procs.length === 0) return 'no processes\r\n';

  let output = '  PID  PPID  STATE       NAME\r\n';
  for (const p of procs) {
    output +=
      `${String(p.pid).padStart(5)}  ${String(p.ppid).padStart(4)}  ` +
      `${p.state.toUpperCase().padEnd(8)}  ${p.name}\r\n`;
  }
  return output;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/jobCommands.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Register commands and update descriptions**

In `src/commands/descriptions.ts`:

Add the five names to `commandNames`:

```ts
export const commandNames = [
  'ls', 'cd', 'cat', 'grep', 'clear',
  'help', 'pwd', 'whoami', 'echo', 'theme', 'history',
  'jobs', 'fg', 'bg', 'kill', 'ps',
];
```

Add descriptions to `commandDescriptions`:

```ts
  jobs: 'list background jobs',
  fg: 'bring a job to the foreground',
  bg: 'resume a job in the background',
  kill: 'terminate a job/process (-9 to force)',
  ps: 'list all processes',
```

Add the `kill` flag to `commandFlags`:

```ts
  kill: ['-9'],
```

In `src/terminal/useTerminal.ts`, add the five command imports (near the other builtin imports):

```ts
import { jobsCommand } from '../commands/builtins/jobs';
import { fgCommand } from '../commands/builtins/fg';
import { bgCommand } from '../commands/builtins/bg';
import { killCommand } from '../commands/builtins/kill';
import { psCommand } from '../commands/builtins/ps';
```

And register them in `getRegistry` (after the `theme` registration):

```ts
      registry.register('jobs', jobsCommand);
      registry.register('fg', fgCommand);
      registry.register('bg', bgCommand);
      registry.register('kill', killCommand);
      registry.register('ps', psCommand);
```

- [ ] **Step 6: Verify full build and tests**

Run: `npm run build` then `npm test`
Expected: build green, all tests pass (existing + 19 new).

- [ ] **Step 7: Commit**

```bash
git add src/commands/builtins/jobs.ts src/commands/builtins/fg.ts src/commands/builtins/bg.ts src/commands/builtins/kill.ts src/commands/builtins/ps.ts src/commands/descriptions.ts src/terminal/useTerminal.ts src/__tests__/jobCommands.test.ts
git commit -m "feat(commands): add jobs/fg/bg/kill/ps"
```

---

### Task 6: Switch rich-content panels to the process model (final integration)

**Files:**
- Modify: `src/types.ts` (remove `setRichContent` from `CommandContext`)
- Modify: `src/terminal/useTerminal.ts`
- Modify: `src/terminal/Terminal.tsx`
- Modify: `src/commands/builtins/cat.ts`
- Modify: `src/commands/builtins/whoami.ts`
- Modify: `src/commands/builtins/clear.ts`

**Interfaces:**
- Consumes: `manager`, `spawnPanel`, `PanelProcess` (all built in prior tasks).
- Produces: `useTerminal` now returns `manager` and `suspendForeground` instead of `setRichContent`; `Terminal` renders the foreground process's view; `cat`/`whoami` spawn panels; `clear` no longer clears panels; `Ctrl+Z`/`Ctrl+C`/`Ctrl+L` behave per spec.

- [ ] **Step 1: Remove `setRichContent` from `CommandContext`**

In `src/types.ts`, delete the `setRichContent` line from `CommandContext` (leave `manager` and `spawnPanel`). The `ReactNode` import stays (still used by `RichContent`); `RichContentMeta` stays (used by `RichContent`).

- [ ] **Step 2: Migrate `cat`, `whoami`, `clear`**

In `src/commands/builtins/cat.ts`, replace each `ctx.setRichContent(...)` call with a `spawnPanel` call:

Image branch — replace:

```ts
    ctx.setRichContent(
      React.createElement('img', {
        src: node.content,
        alt: target,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
      }),
      { title: target, type: ext.slice(1) }
    );
```

with:

```ts
    ctx.spawnPanel(`cat ${target}`, {
      node: React.createElement('img', {
        src: node.content,
        alt: target,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
      }),
      meta: { title: target, type: ext.slice(1) },
    });
```

Markdown branch — replace:

```ts
    ctx.setRichContent(
      React.createElement('div', { className: 'markdown-loading' }, 'Loading...'),
      { title: target, type: 'markdown' }
    );

    import('../../output/MarkdownView').then(({ default: MarkdownView }) => {
      ctx.setRichContent(
        React.createElement(MarkdownView, { content: body }),
        { title: target, type: 'markdown' }
      );
    });
```

with:

```ts
    const proc = ctx.spawnPanel(`cat ${target}`, {
      node: React.createElement('div', { className: 'markdown-loading' }, 'Loading...'),
      meta: { title: target, type: 'markdown' },
    });

    import('../../output/MarkdownView').then(({ default: MarkdownView }) => {
      proc.setView({
        node: React.createElement(MarkdownView, { content: body }),
        meta: { title: target, type: 'markdown' },
      });
    });
```

In `src/commands/builtins/whoami.ts`, replace:

```ts
  ctx.setRichContent(React.createElement(WhoamiPanel), { title: 'whoami', type: 'profile' });
```

with:

```ts
  ctx.spawnPanel('whoami', {
    node: React.createElement(WhoamiPanel),
    meta: { title: 'whoami', type: 'profile' },
  });
```

In `src/commands/builtins/clear.ts`, remove the `ctx.setRichContent(null);` line entirely (leave the `return '\x1b[2J\x1b[H';`).

- [ ] **Step 3: Update useTerminal — remove richContent state**

In `src/terminal/useTerminal.ts`:

1. Remove `RichContentMeta` from the type import (keep `DirNode, RichContent`), and remove `import type { ReactNode } from 'react';` if now unused.
2. In `TerminalState`, remove the `richContent: RichContent | null;` field.
3. In the initial `useState`, remove `richContent: null,`.
4. Delete the `setRichContent` callback entirely.
5. Add `suspendForeground` and `terminateForeground` callbacks (after `spawnPanel`):

```ts
  const suspendForeground = useCallback(() => {
    const pm = processManagerRef.current;
    const fg = pm.getForeground();
    if (fg) pm.signal(fg.pid, 'SIGSTOP');
  }, []);

  const terminateForeground = useCallback(() => {
    const pm = processManagerRef.current;
    const fg = pm.getForeground();
    if (fg) pm.signal(fg.pid, 'SIGTERM');
  }, []);
```

6. Add the re-render subscription. After the `spawnPanel`/`suspendForeground` callbacks, add:

```ts
  const [, forceRender] = useState(0);
  useEffect(() => {
    return processManagerRef.current.subscribe(() => forceRender((n) => n + 1));
  }, []);
```

7. In `executeCommand`, replace the "clear rich content" block:

```ts
    // Clear rich content for non-cat commands
    if (!['cat', 'whoami'].includes(parsed.cmd)) {
      setRichContent(null);
    }
```

with:

```ts
    // Suspend the foreground process for commands that don't manage it themselves
    if (!['cat', 'whoami', 'clear'].includes(parsed.cmd)) {
      suspendForeground();
    }
```

And remove `setRichContent,` from the `ctx` object literal (keep `manager` and `spawnPanel`). Remove `setRichContent` from the `executeCommand` dependency array; add `suspendForeground`.

8. Update the key handlers in `onData`:

Ctrl+L — replace:

```ts
      if (data === '\x0c') {
        if (inputBufferRef.current.length === 0) {
          setRichContent(null);
          term.write('\x1b[2J\x1b[H');
          writePrompt();
        }
        return;
      }
```

with (clear screen only, don't touch jobs):

```ts
      if (data === '\x0c') {
        if (inputBufferRef.current.length === 0) {
          term.write('\x1b[2J\x1b[H');
          writePrompt();
        }
        return;
      }
```

Ctrl+C — replace:

```ts
      if (data === '\x03') {
        setRichContent(null);
        suggestionRef.current = '';
        term.write('^C\r\n');
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        writePrompt();
        return;
      }
```

with:

```ts
      if (data === '\x03') {
        terminateForeground();
        suggestionRef.current = '';
        term.write('^C\r\n');
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        writePrompt();
        return;
      }
```

Add Ctrl+Z (new handler, insert before the Ctrl+C handler):

```ts
      // Handle Ctrl+Z (suspend foreground process to background)
      if (data === '\x1a') {
        const fg = processManagerRef.current.getForeground();
        if (fg) {
          suspendForeground();
          term.write(`^Z\r\n[1]+  Stopped   ${fg.name}\r\n`);
        } else {
          term.write('^Z\r\n');
        }
        suggestionRef.current = '';
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        writePrompt();
        return;
      }
```

9. Update `initTerminal`'s dependency array: remove `setRichContent`, add `suspendForeground` and `terminateForeground`.

10. Update the `useTerminal` return object to expose the manager and suspend helper:

```ts
  return {
    containerRef,
    initTerminal,
    state,
    manager: processManagerRef.current,
    suspendForeground,
  };
```

- [ ] **Step 4: Update Terminal.tsx to render the foreground process view**

In `src/terminal/Terminal.tsx`, replace the destructure and the `richContent` references:

Replace the top of the component:

```ts
  const { containerRef, initTerminal, state, setRichContent } = useTerminal();
  const richBodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollLabel, setScrollLabel] = useState('Top');
```

with:

```ts
  const { containerRef, initTerminal, manager, suspendForeground } = useTerminal();
  const richBodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollLabel, setScrollLabel] = useState('Top');

  const richContent = manager.getForeground()?.view() ?? null;
```

Replace the scroll-reset effect dependency and the render:

- Change `}, [state.richContent]);` to `}, [richContent]);`.
- Change `{state.richContent && (` to `{richContent && (`.
- Change `onClick={() => setRichContent(null)}` to `onClick={suspendForeground}`.
- Change `{state.richContent.node}` to `{richContent.node}`.
- Change `{state.richContent.meta.title}` to `{richContent.meta.title}`.
- Change `{state.richContent.meta.type && (...[state.richContent.meta.type]...)}` to use `richContent.meta.type`.
- Change `{state.richContent.meta.type === 'markdown' && (` to `{richContent.meta.type === 'markdown' && (`.

- [ ] **Step 5: Verify build and tests**

Run: `npm run build` then `npm test`
Expected: build green, all tests pass. No references to `setRichContent` or `richContent` remain (verify with `grep -rn "setRichContent\|richContent" src` — should return nothing except the `RichContent` type in `types.ts` and `process.ts`).

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev` and verify:
1. `cat <blog>/<file>.md` opens the markdown panel; clicking the backdrop hides it.
2. `jobs` shows `[1]+  Stopped   cat <file>.md`.
3. `fg %1` reopens the same panel.
4. `Ctrl+Z` while a panel is open suspends it; `jobs` lists it; `fg` restores it.
5. `Ctrl+C` while a panel is open terminates it (removed from `jobs`).
6. `Ctrl+L` / `clear` clear the screen but leave the job in `jobs`.
7. `cat` two files in succession → first auto-suspends to background; `jobs` lists both; `fg %1` restores the first.
8. `kill %1` terminates; `kill -9 %1` force-terminates; `kill 999` prints an error.
9. `ps` shows `PID PPID STATE NAME` rows.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/terminal/useTerminal.ts src/terminal/Terminal.tsx src/commands/builtins/cat.ts src/commands/builtins/whoami.ts src/commands/builtins/clear.ts
git commit -m "feat(process): switch rich-content panels to the process model"
```

---

## Self-Review Notes

- **Spec coverage:** every requirement maps to a task — signal set + state machine (Task 1), manager/fg/bg/%n (Task 2), PanelProcess (Task 3), CommandContext integration (Task 4), five commands (Task 5), close=suspend / Ctrl+Z / Ctrl+C=terminate / Ctrl+L=clear / clear-command-exempt (Task 6).
- **Type consistency:** `Signal`, `Process`, `BaseProcess`, `ProcessManager`, `PanelProcess`, `spawnPanel`, `suspendForeground`, `terminateForeground` names are used identically across tasks.
- **No placeholders:** all code is inlined; the only prose steps are verification/commit.
