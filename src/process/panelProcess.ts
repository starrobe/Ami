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
