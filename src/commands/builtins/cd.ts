import type { CommandHandler } from '../../types';
import { resolvePath, getNode, isDirectory } from '../../fs/filesystem';

export function createCdCommand(
  getPrevCwd: () => string,
  setPrevCwd: (p: string) => void
): CommandHandler {
  return (ctx, parsed) => {
    let target = parsed.args[0];

    if (!target || target === '~') {
      target = '~';
    }

    if (target === '-') {
      const prev = getPrevCwd();
      if (prev === ctx.cwd) {
        return 'cd: no previous directory\r\n';
      }
      const prevDisplay = prev.replace('/home/user', '~');
      setPrevCwd(ctx.cwd);
      ctx.setCwd(prev);
      return prevDisplay + '\r\n';
    }

    const path = resolvePath(ctx.cwd, target);

    if (!getNode(ctx.fs, path)) {
      return `cd: ${target}: No such file or directory\r\n`;
    }

    if (!isDirectory(ctx.fs, path)) {
      return `cd: ${target}: Not a directory\r\n`;
    }

    setPrevCwd(ctx.cwd);
    ctx.setCwd(path);
    return '';
  };
}
