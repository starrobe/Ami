// Commands that accept file/directory arguments (for tab completion)
export const fileArgCommands = ['cat', 'cd', 'ls', 'grep'];

// Known flags per command (for tab completion)
export const commandFlags: Record<string, string[]> = {
  ls: ['-l', '-a'],
  grep: ['-i', '-n', '-r', '-t', '-h'],
  echo: ['-n'],
};

export const commandNames = [
  'ls', 'cd', 'cat', 'grep', 'clear',
  'help', 'pwd', 'whoami', 'echo', 'theme', 'history',
];

export const commandDescriptions: Record<string, string> = {
  ls: 'list directory contents',
  cd: 'change the working directory',
  cat: 'preview files (md, images, text)',
  grep: 'search text (-i -n -r) or tags (-t), help (-h)',
  clear: 'clear the terminal screen',
  help: 'display this help message',
  pwd: 'print working directory',
  whoami: 'display user profile',
  echo: 'display a line of text',
  theme: 'change terminal color theme',
  history: 'display command history',
};
