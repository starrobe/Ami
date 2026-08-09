import type { CommandHandler } from '../../types';

export const echoCommand: CommandHandler = (_ctx, parsed) => {
  const text = parsed.args.join(' ');
  return { output: parsed.flags.includes('n') ? text : text + '\r\n' };
};
