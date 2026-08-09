import React from 'react';
import type { CommandHandler } from '../../types';

const WhoamiPanel = () => {
  const info: [string, string, string?][] = [
    ['Name', 'adon'],
    ['Shell', 'ami v1.0.0'],
    ['Core', 'Xterm.js', 'https://xtermjs.org'],
    ['GitHub', 'https://github.com/starrobe', 'https://github.com/starrobe'],
    ['Email', 'starrobe@163.com', 'mailto:starrobe@163.com'],
    ['Blog', 'https://starrobe.cn', 'https://starrobe.cn'],
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
      ...info.map(([key, value, href]) =>
        React.createElement('div', { className: 'whoami-row', key },
          React.createElement('span', { className: 'whoami-key' }, key.padEnd(10)),
          href
            ? React.createElement('a', { className: 'whoami-value whoami-link', href, target: '_blank', rel: 'noopener noreferrer' }, value)
            : React.createElement('span', { className: 'whoami-value' }, value),
        )
      )
    )
  );
};

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  ctx.setRichContent(React.createElement(WhoamiPanel));
  return { output: '' };
};
