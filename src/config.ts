import pkg from '../package.json';

export interface ProfileInfo {
  key: string;
  value: string;
  href?: string;
}

export const avatarUrl = '/avatar.png';
export const appVersion = pkg.version;

export const profile: ProfileInfo[] = [
  { key: 'Name', value: 'adon' },
  { key: 'Shell', value: `ami v${appVersion}` },
  { key: 'Core', value: 'Xterm.js', href: 'https://xtermjs.org' },
  { key: 'GitHub', value: 'https://github.com/starrobe', href: 'https://github.com/starrobe' },
  { key: 'Email', value: 'starrobe@163.com', href: 'mailto:starrobe@163.com' },
  { key: 'Blog', value: 'https://starrobe.cn', href: 'https://starrobe.cn' },
];
