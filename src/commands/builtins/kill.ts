import type { CommandHandler } from '../../types';

export const killCommand: CommandHandler = (ctx, parsed) => {
  const ref = parsed.args[0];
  if (!ref) return 'kill: usage: kill [-9] <pid|%job>\r\n';
  const proc = ctx.manager.resolve(ref);
  if (!proc) return `kill: (${ref}) - No such process\r\n`;
  ctx.manager.signal(proc.pid, parsed.flags.includes('9') ? 'SIGKILL' : 'SIGTERM');
  return undefined;
};
