import type { Theme } from '../types';

export const themes: Record<string, Theme> = {
  default: {
    background: '#0a0a0a',
    foreground: '#E0E0E0',
    cursor: '#FFFFFF',
    selection: 'rgba(255, 255, 255, 0.25)',
    black: '#0a0a0a',
    red: '#FF6B6B',
    green: '#50FA7B',
    yellow: '#FFD700',
    blue: '#58A6FF',
    magenta: '#BC8CFF',
    cyan: '#00D4AA',
    white: '#E0E0E0',
    brightBlack: '#484F58',
    brightRed: '#FF6B6B',
    brightGreen: '#50FA7B',
    brightYellow: '#FFD700',
    brightBlue: '#58A6FF',
    brightMagenta: '#BC8CFF',
    brightCyan: '#00D4AA',
    brightWhite: '#FFFFFF',
  },
};

export function getTheme(name: string): Theme {
  return themes[name] || themes['default'];
}

export function getThemeNames(): string[] {
  return Object.keys(themes);
}
