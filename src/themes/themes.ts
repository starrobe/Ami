import type { Theme } from '../types';

export const themes: Record<string, Theme> = {
  default: {
    background: '#0a0a0a',
    foreground: '#E0E0E0',
    cursor: '#FFFFFF',
    selection: 'rgba(255, 255, 255, 0.25)',
    black: '#0a0a0a',
  },
};

export function getTheme(name: string): Theme {
  return themes[name] || themes['default'];
}

export function getThemeNames(): string[] {
  return Object.keys(themes);
}
