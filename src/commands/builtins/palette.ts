// src/commands/builtins/palette.ts
import React from 'react';
import type { CommandHandler } from '../../types';
import type { PanelProcess } from '../../process/panelProcess';
import { listBlogs } from '../../fs/blogIndex';
import { openMarkdownPanel } from '../openMarkdown';
import Palette from '../../components/Palette';
import { createSearchStore } from '../../components/searchStore';

export const paletteCommand: CommandHandler = (ctx) => {
  const blogs = listBlogs(ctx.fs);
  const search = createSearchStore();

  let proc: PanelProcess;

  const onOpen = (path: string) => {
    const blog = blogs.find((b) => b.path === path);
    if (!blog) return;
    ctx.manager.signal(proc.pid, 'SIGTERM');
    openMarkdownPanel(ctx, `cat ${path}`, blog.title, blog.content);
  };
  const onClose = () => {
    ctx.manager.signal(proc.pid, 'SIGTERM');
  };
  const onSuspend = () => {
    ctx.suspendForeground();
  };
  const onInterrupt = () => {
    ctx.interruptForeground();
  };

  proc = ctx.spawnPanel('palette', {
    node: React.createElement(Palette, { blogs, onOpen, onClose, onSuspend, onInterrupt, search }),
    meta: { title: 'palette', type: 'palette', interactive: true },
    search,
  });
  return '';
};
