import type { CommandHandler } from '../../types';

export const jobsCommand: CommandHandler = (ctx, _parsed) => {
  const jobs = ctx.manager.jobs();
  if (jobs.length === 0) return 'jobs: no jobs\r\n';

  let output = '';
  jobs.forEach((p, i) => {
    const mark = i === jobs.length - 1 ? '+' : i === jobs.length - 2 ? '-' : ' ';
    const state = p.state === 'stopped' ? 'Stopped' : 'Running';
    output += `[${i + 1}]${mark}  ${state.padEnd(10)}  ${p.name}\r\n`;
  });
  return output;
};
