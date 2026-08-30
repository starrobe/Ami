import type { CommandHandler } from '../../types';

export const bgCommand: CommandHandler = (ctx, parsed) => {
  return ctx.manager.bg(parsed.args[0]) ?? undefined;
};
