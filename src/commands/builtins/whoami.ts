import React from 'react';
import type { CommandHandler } from '../../types';
import { profile, avatarUrl } from '../../config';

const WhoamiPanel = () => {
  return React.createElement('div', { className: 'whoami-panel' },
    React.createElement('div', { className: 'whoami-avatar-wrap' },
      React.createElement('img', {
        src: avatarUrl,
        className: 'whoami-img',
        alt: 'avatar',
      })
    ),
    React.createElement('div', { className: 'whoami-info' },
      ...profile.map(({ key, value, href }) =>
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
  ctx.setRichContent(React.createElement(WhoamiPanel), { title: 'whoami', type: 'profile' });
  return '';
};
