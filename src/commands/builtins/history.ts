import type { CommandHandler } from '../../types';

export function createHistoryCommand(
  getHistory: () => string[]
): CommandHandler {
  return (_ctx, _parsed) => {
    const history = getHistory();
    let output = '\r\n';
    history.forEach((entry, i) => {
      output += `  ${String(i + 1).padStart(4)}  ${entry}\r\n`;
    });
    output += '\r\n';
    return output;
  };
}
