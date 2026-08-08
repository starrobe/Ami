import React from 'react';
import type { CommandHandler } from '../../types';
import AsciiAvatar from '../../output/AsciiAvatar';

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  ctx.setRichContent(
    React.createElement(AsciiAvatar, {
      url: 'https://starrobe-blog.oss-cn-beijing.aliyuncs.com/avatar/jashinchan.jpg',
      maxWidth: 40,
    })
  );
  return { output: 'user\r\n' };
};
