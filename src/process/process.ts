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
      case 'SIGINT':
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
