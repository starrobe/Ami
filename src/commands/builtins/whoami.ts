import type { CommandHandler } from '../../types';

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  const avatar = ctx.getAsciiAvatar();
  if (avatar) {
    return { output: '\r\n' + avatar + 'user\r\n' };
  }
  return { output: 'user\r\n' };
};
