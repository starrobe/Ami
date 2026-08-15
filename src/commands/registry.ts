import type { CommandContext, ParsedCommand, CommandHandler } from '../types';

export interface CommandRegistry {
  register: (name: string, handler: CommandHandler) => void;
  execute: (ctx: CommandContext, parsed: ParsedCommand) => string | null;
  getNames: () => string[];
}

export function createRegistry(): CommandRegistry {
  const commands = new Map<string, CommandHandler>();

  return {
    register(name: string, handler: CommandHandler) {
      commands.set(name, handler);
    },

    execute(ctx: CommandContext, parsed: ParsedCommand): string | null {
      const handler = commands.get(parsed.cmd);
      if (!handler) {
        return `bash: ${parsed.cmd}: command not found`;
      }
      try {
        return handler(ctx, parsed) ?? null;
      } catch (err) {
        return `bash: ${parsed.cmd}: ${err instanceof Error ? err.message : 'error'}`;
      }
    },

    getNames() {
      return Array.from(commands.keys()).sort();
    },
  };
}
