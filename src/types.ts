import type { ReactNode } from 'react';

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
  setRichContent: (node: ReactNode | null) => void;
  theme: string;
  setTheme: (name: string) => void;
  term?: any; // xterm.js Terminal instance for advanced features (decorations, markers)
}

export type CommandResult = {
  output?: string;
  richContent?: ReactNode;
};

export type CommandHandler = (
  ctx: CommandContext,
  parsed: ParsedCommand
) => CommandResult | void;

export interface Theme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}
