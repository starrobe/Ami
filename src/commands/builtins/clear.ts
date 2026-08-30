import type { CommandHandler } from '../../types';

export const clearCommand: CommandHandler = (_ctx, _parsed) => {
  return '\x1b[2J\x1b[H';
};
