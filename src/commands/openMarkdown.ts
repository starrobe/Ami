import React from 'react';
import type { CommandContext } from '../types';
import type { PanelProcess } from '../process/panelProcess';

/**
 * Opens a `.md` file as a rich Markdown panel, reusing cat's lazy-load
 * pattern (loading placeholder → MarkdownView). Shared by `cat` and `palette`.
 */
export function openMarkdownPanel(
  ctx: CommandContext,
  name: string,
  title: string,
  rawContent: string
): PanelProcess {
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const body = frontmatterMatch ? frontmatterMatch[2] : rawContent;

  const proc = ctx.spawnPanel(name, {
    node: React.createElement('div', { className: 'markdown-loading' }, 'Loading...'),
    meta: { title, type: 'markdown' },
  });

  import('../output/MarkdownView').then(({ default: MarkdownView }) => {
    proc.setView({
      node: React.createElement(MarkdownView, { content: body }),
      meta: { title, type: 'markdown' },
    });
  });

  return proc;
}
