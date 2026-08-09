import React from 'react';
import type { CommandHandler } from '../../types';
import { resolvePath, getNode } from '../../fs/filesystem';
import MarkdownView from '../../output/MarkdownView';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

export const catCommand: CommandHandler = (ctx, parsed) => {
  if (parsed.args.length === 0) {
    return { output: 'cat: missing file operand\r\n' };
  }

  const target = parsed.args[0];
  const path = resolvePath(ctx.fs, ctx.cwd, target);
  const node = getNode(ctx.fs, path);

  if (!node) {
    return { output: `cat: ${target}: No such file or directory\r\n` };
  }

  if (node.type === 'dir') {
    return { output: `cat: ${target}: Is a directory\r\n` };
  }

  // Images → rich content preview
  const ext = target.slice(target.lastIndexOf('.')).toLowerCase();
  if (IMAGE_EXTS.includes(ext)) {
    ctx.setRichContent(
      React.createElement('img', {
        src: node.content,
        alt: target,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
      })
    );
    return { output: '' };
  }

  // .md files → rich Markdown rendering
  if (target.endsWith('.md')) {
    const content = node.content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const body = frontmatterMatch ? frontmatterMatch[2] : content;

    ctx.setRichContent(
      React.createElement(MarkdownView, { content: body })
    );
    return { output: '' };
  }

  // Plain files → terminal text
  return { output: node.content };
};
