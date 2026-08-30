import { getUserName } from '../config';

/** Renders the shell prompt line (without the leading newline). */
export function promptString(displayPath: string): string {
  return '\x1b[37m' + getUserName() + '@ami\x1b[0m:\x1b[37m' + displayPath + '\x1b[0m $ ';
}
