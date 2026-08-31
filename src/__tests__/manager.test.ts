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

  it('spawn demotes the current foreground without suspending it', () => {
    const pm = createProcessManager();
    const p1 = pm.spawn((pid) => makeProcess(pid)) as SpyProcess;
    const p2 = pm.spawn((pid) => makeProcess(pid));
    expect(p1.state).toBe('running');
    expect(pm.getForeground()).toBe(p2);
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

  it('fg switches foreground without suspending the old one', () => {
    const pm = createProcessManager();
    const p1 = pm.spawn((pid) => makeProcess(pid));
    const p2 = pm.spawn((pid) => makeProcess(pid));
    pm.fg('%1');
    expect(p2.state).toBe('running');
    expect(pm.getForeground()).toBe(p1);
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
