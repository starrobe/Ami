import type { CommandHandler } from '../../types';
import { getThemeNames } from '../../themes/themes';

export const themeCommand: CommandHandler = (ctx, parsed) => {
  if (parsed.args.length === 0) {
    const current = ctx.theme;
    const names = getThemeNames();
    const list = names.map(n => (n === current ? `* ${n}` : `  ${n}`)).join('\r\n');
    return { output: `Current theme: ${current}\r\n\r\n${list}\r\n` };
  }

  const name = parsed.args[0];
  if (!getThemeNames().includes(name)) {
    return { output: `theme: ${name}: theme not found. Available: ${getThemeNames().join(', ')}\r\n` };
  }

  ctx.setTheme(name);
  return { output: `Theme changed to ${name}\r\n` };
};
