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
      const prevDisplay = prev.replace('/home/user', '~');
      setPrevCwd(ctx.cwd);
      ctx.setCwd(prev);
      return { output: prevDisplay + '\r\n' };
    }

    const path = resolvePath(ctx.fs, ctx.cwd, target);

    if (!getNode(ctx.fs, path)) {
      return { output: `cd: ${target}: No such file or directory\r\n` };
    }

    if (!isDirectory(ctx.fs, path)) {
      return { output: `cd: ${target}: Not a directory\r\n` };
    }

    setPrevCwd(ctx.cwd);
    ctx.setCwd(path);
    return { output: '' };
  };
}
