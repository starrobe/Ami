import type { CommandHandler } from '../../types';

export const psCommand: CommandHandler = (ctx, _parsed) => {
  const procs = ctx.manager.list();
  if (procs.length === 0) return 'no processes\r\n';

  let output = '  PID  PPID  STATE       NAME\r\n';
  for (const p of procs) {
    output +=
      `${String(p.pid).padStart(5)}  ${String(p.ppid).padStart(4)}  ` +
      `${p.state.toUpperCase().padEnd(8)}  ${p.name}\r\n`;
  }
  return output;
};
