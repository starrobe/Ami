import pkg from '../package.json';

interface ProfileInfo {
  key: string;
  value: string;
  href?: string;
}

export const avatarUrl = 'https://img.starrobe.cn/avatar/jashinchan.png';
export const appVersion = pkg.version;

export const profile: ProfileInfo[] = [
  { key: 'Name', value: 'adon' },
  { key: 'Desc', value: '龙虎榜上见'},
  { key: 'Shell', value: `ami v${appVersion}`, href: 'https://github.com/starrobe/Ami'},
  { key: 'GitHub', value: 'https://github.com/starrobe', href: 'https://github.com/starrobe' },
  { key: 'Email', value: 'starrobe@163.com', href: 'mailto:starrobe@163.com' },
  { key: 'Blog', value: 'https://www.starrobe.cn', href: 'https://www.starrobe.cn' },
];

export function getUserName(): string {
  return profile.find(p => p.key === 'Name')?.value || 'user';
}
