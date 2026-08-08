import React from 'react';
import type { CommandHandler } from '../../types';
import AsciiAvatar from '../../output/AsciiAvatar';

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  ctx.setRichContent(
    React.createElement(AsciiAvatar, {
      url: '/avatar.jpg',
      maxWidth: 120,
    })
  );
  return { output: 'user\r\n' };
};
