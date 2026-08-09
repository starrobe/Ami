import React from 'react';
import { createRoot } from 'react-dom/client';
import type { CommandHandler } from '../../types';
import AsciiAvatar from '../../output/AsciiAvatar';

export const whoamiCommand: CommandHandler = (ctx, _parsed) => {
  const term = ctx.term;
  if (!term) return { output: 'user\r\n' };

  // Write empty lines to make space for the avatar
  const AVATAR_ROWS = 20;
  for (let i = 0; i < AVATAR_ROWS; i++) {
    ctx.appendOutput(' \r\n');
  }

  // Register marker at the line above what we just wrote (where avatar starts)
  const marker = term.registerMarker(-AVATAR_ROWS);
  if (marker) {
    const decoration = term.registerDecoration({
      marker,
      width: 60,
      height: AVATAR_ROWS,
    });

    if (decoration) {
      decoration.onRender((element: HTMLElement) => {
        // Only render once
        if (element.children.length > 0) return;

        const div = document.createElement('div');
        div.style.cssText = 'position:absolute; left:0; top:0;';
        element.appendChild(div);

        const root = createRoot(div);
        root.render(
          React.createElement(AsciiAvatar, {
            url: '/avatar.jpg',
            maxWidth: 400,
          })
        );
      });
    }
  }

  return { output: 'user\r\n' };
};
