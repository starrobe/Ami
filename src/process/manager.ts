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
      } else if (sig === 'SIGTERM' || sig === 'SIGKILL' || sig === 'SIGINT') {
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
