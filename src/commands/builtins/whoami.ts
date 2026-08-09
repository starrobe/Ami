import React from 'react';
import type { CommandHandler } from '../../types';

const WhoamiPanel = () => {
  const info: [string, string][] = [
    ['Name', 'user'],
    ['Shell', 'ami v1.0.0'],
    ['Theme', 'default'],
    ['Location', '/home/user'],
    ['Blog', 'blog/'],
    ['Projects', 'projects/'],
  ];

  return React.createElement('div', { className: 'whoami-panel' },
    React.createElement('div', { className: 'whoami-avatar-wrap' },
      React.createElement('img', {
        src: '/avatar.png',
        className: 'whoami-img',
        alt: 'avatar',
      })
    ),
    React.createElement('div', { className: 'whoami-info' },
      ...info.map(([key, value]) =>
        React.createElement('div', { className: 'whoami-row', key },
          React.createElement('span', { className: 'whoami-key' }, key.padEnd(10)),
          React.createElement('span', { className: 'whoami-value' }, value),
        )
      )
    )
  );
};

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  ctx.setRichContent(React.createElement(WhoamiPanel));
  return { output: '' };
};
