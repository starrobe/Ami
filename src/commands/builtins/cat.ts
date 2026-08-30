import React from 'react';
import type { CommandHandler } from '../../types';
import { resolvePath, getNode } from '../../fs/filesystem';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

export const catCommand: CommandHandler = (ctx, parsed) => {
  if (parsed.args.length === 0) {
    return 'cat: missing file operand\r\n';
  }

  const target = parsed.args[0];
  const path = resolvePath(ctx.cwd, target);
  const node = getNode(ctx.fs, path);

  if (!node) {
    return `cat: ${target}: No such file or directory\r\n`;
  }

  if (node.type === 'dir') {
    return `cat: ${target}: Is a directory\r\n`;
  }

  // Images → rich content preview
  const ext = target.slice(target.lastIndexOf('.')).toLowerCase();
  if (IMAGE_EXTS.includes(ext)) {
    ctx.spawnPanel(`cat ${target}`, {
      node: React.createElement('img', {
        src: node.content,
        alt: target,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
      }),
      meta: { title: target, type: ext.slice(1) },
    });
    return '';
  }

  // .md files → rich Markdown rendering (lazy loaded)
  if (target.endsWith('.md')) {
    const content = node.content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const body = frontmatterMatch ? frontmatterMatch[2] : content;

    // Show loading placeholder immediately
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
    return '';
  }

  // Plain files → terminal text
  return node.content;
};
