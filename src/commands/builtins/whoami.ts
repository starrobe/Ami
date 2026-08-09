import type { CommandHandler } from '../../types';

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  // Avatar is pre-computed and stored globally by useTerminal
  const avatarText = (window as any).__avatarText as string;
  if (avatarText) {
    ctx.appendOutput(avatarText);
  }
  return { output: 'user\r\n' };
};
