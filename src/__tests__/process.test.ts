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
