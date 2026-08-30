import type { CommandHandler } from '../../types';

export const fgCommand: CommandHandler = (ctx, parsed) => {
  return ctx.manager.fg(parsed.args[0]) ?? undefined;
};
