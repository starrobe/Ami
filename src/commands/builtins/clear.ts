import type { CommandHandler } from '../../types';

export const clearCommand: CommandHandler = (ctx, _parsed) => {
  ctx.setRichContent(null);
  return { output: '\x1b[2J\x1b[H' };
};
