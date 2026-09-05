import { createRegistry } from './registry';
import type { CommandRegistry } from './registry';
import { createHelpCommand } from './builtins/help';
import { echoCommand } from './builtins/echo';
import { clearCommand } from './builtins/clear';
import { pwdCommand } from './builtins/pwd';
import { whoamiCommand } from './builtins/whoami';
import { createHistoryCommand } from './builtins/history';
import { lsCommand } from './builtins/ls';
import { createCdCommand } from './builtins/cd';
import { paletteCommand } from './builtins/palette';
import { catCommand } from './builtins/cat';
import { themeCommand } from './builtins/theme';
import { jobsCommand } from './builtins/jobs';
import { fgCommand } from './builtins/fg';
import { bgCommand } from './builtins/bg';
import { killCommand } from './builtins/kill';
import { psCommand } from './builtins/ps';

/** Builds the command registry with every builtin command wired up. */
export function createCommandRegistry(
  getHistory: () => string[],
  getPrevCwd: () => string,
  setPrevCwd: (p: string) => void
): CommandRegistry {
  const registry = createRegistry();
  registry.register('help', createHelpCommand(registry));
  registry.register('echo', echoCommand);
  registry.register('clear', clearCommand);
  registry.register('pwd', pwdCommand);
  registry.register('whoami', whoamiCommand);
  registry.register('history', createHistoryCommand(getHistory));
  registry.register('ls', lsCommand);
  registry.register('cd', createCdCommand(getPrevCwd, setPrevCwd));
  registry.register('palette', paletteCommand);
  registry.register('cat', catCommand);
  registry.register('theme', themeCommand);
  registry.register('jobs', jobsCommand);
  registry.register('fg', fgCommand);
  registry.register('bg', bgCommand);
  registry.register('kill', killCommand);
  registry.register('ps', psCommand);
  return registry;
}
