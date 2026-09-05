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
    output += '\r\nSearch palette (palette / Ctrl+P):\r\n\r\n';
    output += '  Up/Down / j/k   move selection (wraps)\r\n';
    output += '  /               search (filter by title)\r\n';
    output += '  Enter           open selected blog\r\n';
    output += '  q               close\r\n';
    output += '  Esc             back / cancel search / close\r\n';
    output += '  Tab / 1 / 2     switch mode (blogs / tags)\r\n';
    output += '  Ctrl+Z / Ctrl+C suspend / terminate palette\r\n';
    output += '\r\n';
    return output;
  };
}
