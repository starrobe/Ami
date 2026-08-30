import type { ReactNode } from 'react';
import type { ProcessManager } from './process/manager';
import type { PanelProcess } from './process/panelProcess';

export type FileType = 'file' | 'dir';

export interface FileNode {
  type: 'file';
  content: string;
  metadata?: Record<string, string>;
}

export interface DirNode {
  type: 'dir';
  children: Record<string, FSEntry>;
}

export type FSEntry = FileNode | DirNode;

export interface RichContentMeta {
  title: string;
  type: string;
}

export interface RichContent {
  node: ReactNode;
  meta: RichContentMeta;
}

export interface ParsedCommand {
  cmd: string;
  args: string[];
  flags: string[];
}

export interface CommandContext {
  cwd: string;
  fs: DirNode;
  setCwd: (path: string) => void;
  appendOutput: (text: string) => void;
  setRichContent: (node: ReactNode | null, meta?: RichContentMeta) => void;
  manager: ProcessManager;
  spawnPanel: (name: string, rich: RichContent) => PanelProcess;
  theme: string;
  setTheme: (name: string) => void;
  termCols: number;
}

// Commands return plain text written straight to the terminal, or nothing
// (output is produced through ctx.appendOutput / ctx.setRichContent instead).
export type CommandHandler = (
  ctx: CommandContext,
  parsed: ParsedCommand
) => string | void;

// Only the fields the app actually consumes (terminal theme + page chrome).
export interface Theme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
}
