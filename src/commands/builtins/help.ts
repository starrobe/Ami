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
    output += '\r\nKeyboard shortcuts:\r\n\r\n';
    output += '  Ctrl+Z   suspend foreground job\r\n';
    output += '  Ctrl+C   terminate foreground job\r\n';
    output += '  Ctrl+L   clear screen\r\n';
    output += '  Tab      autocomplete / cycle\r\n';
    output += '  Up/Down  command history\r\n';
    output += '  Ctrl+P   open search palette\r\n';
    output += '\r\n';
    return output;
  };
}
