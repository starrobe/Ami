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
    manager: pm,
    spawnPanel: () => { throw new Error('unused'); },
    suspendForeground: () => {},
    interruptForeground: () => {},
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
