import type { CommandHandler } from '../../types';
import type { CommandRegistry } from '../registry';

export function createHelpCommand(registry: CommandRegistry): CommandHandler {
  return (_ctx) => {
    const names = registry.getNames();
    const descriptions: Record<string, string> = {
      ls: 'list directory contents',
      cd: 'change the working directory',
      cat: 'concatenate and print files',
      grep: 'search for patterns in files',
      clear: 'clear the terminal screen',
      help: 'display this help message',
      pwd: 'print working directory',
      whoami: 'display current user',
      echo: 'display a line of text',
      theme: 'change terminal color theme',
      history: 'display command history',
    };

    let output = '\r\nAvailable commands:\r\n\r\n';
    for (const name of names) {
      const desc = descriptions[name] || '';
      output += `  ${name.padEnd(12)} ${desc}\r\n`;
    }
    output += '\r\n';
    return { output };
  };
}
