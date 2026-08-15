import type { CommandHandler } from '../../types';
import type { CommandRegistry } from '../registry';
import { commandDescriptions } from '../descriptions';

export function createHelpCommand(registry: CommandRegistry): CommandHandler {
  return (_ctx) => {
    const names = registry.getNames();

    let output = '\r\nAvailable commands:\r\n\r\n';
    for (const name of names) {
      const desc = commandDescriptions[name] || '';
      output += `  ${name.padEnd(12)} ${desc}\r\n`;
    }
    output += '\r\n';
    return output;
  };
}
