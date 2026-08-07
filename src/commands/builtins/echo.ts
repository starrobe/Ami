import type { CommandHandler } from '../../types';

export const echoCommand: CommandHandler = (_ctx, parsed) => {
  return { output: parsed.args.join(' ') + '\r\n' };
};
