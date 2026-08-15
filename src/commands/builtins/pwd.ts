import type { CommandHandler } from '../../types';

export const pwdCommand: CommandHandler = (ctx, _parsed) => {
  return ctx.cwd.replace('/home/user', '~') + '\r\n';
};
