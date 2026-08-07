import type { CommandHandler } from '../../types';

export const clearCommand: CommandHandler = (_ctx, _parsed) => {
  // Handled specially in terminal — sends ANSI clear sequence
  return { output: '\x1b[2J\x1b[H' };
};
