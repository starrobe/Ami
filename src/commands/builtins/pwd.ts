import type { CommandHandler } from '../../types';

export const pwdCommand: CommandHandler = (ctx, _parsed) => {
  const displayPath = ctx.cwd.replace('/home/user', '~');
  return { output: displayPath + '\r\n' };
};
