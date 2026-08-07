import type { CommandHandler } from '../../types';

export const whoamiCommand: CommandHandler = (_ctx, _parsed) => {
  return { output: 'user\r\n' };
};
