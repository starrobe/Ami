import type { CommandHandler } from '../../types';

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  const iip = (ctx as any).getAvatarIIP?.();
  if (iip) {
    ctx.appendOutput(iip + '\r\nuser\r\n');
    return;
  }
  return { output: 'user\r\n' };
};
