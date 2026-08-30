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
