import type { CommandHandler } from '../../types';
import { getThemeNames } from '../../themes/themes';

export const themeCommand: CommandHandler = (ctx, parsed) => {
  const names = getThemeNames();

  if (parsed.args.length === 0) {
    const list = names.map(n => (n === ctx.theme ? `* ${n}` : `  ${n}`)).join('\r\n');
    return `Current theme: ${ctx.theme}\r\n\r\n${list}\r\n`;
  }

  const name = parsed.args[0];
  if (!names.includes(name)) {
    return `theme: ${name}: theme not found. Available: ${names.join(', ')}\r\n`;
  }

  ctx.setTheme(name);
  return `Theme changed to ${name}\r\n`;
};
