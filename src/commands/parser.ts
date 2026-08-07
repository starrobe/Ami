import type { ParsedCommand } from '../types';

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;

  const cmd = tokens[0].toLowerCase();
  const flags: string[] = [];
  const args: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-') && token.length > 1 && !token.startsWith('--')) {
      // -la → ['l', 'a']
      for (const ch of token.slice(1)) {
        flags.push(ch);
      }
    } else {
      args.push(token);
    }
  }

  return { cmd, args, flags };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && input[i] === ' ') i++;
    if (i >= input.length) break;

    // Quoted string
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      i++;
      let token = '';
      while (i < input.length && input[i] !== quote) {
        token += input[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && input[i] !== ' ') {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}
