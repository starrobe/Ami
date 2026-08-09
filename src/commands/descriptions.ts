// Commands that accept file/directory arguments (for tab completion)
export const fileArgCommands = ['cat', 'cd', 'ls', 'grep'];

// Known flags per command (for tab completion)
export const commandFlags: Record<string, string[]> = {
  ls: ['-l', '-a'],
  grep: ['-i', '-n', '-r', '-t'],
  echo: ['-n'],
};

export const commandNames = Object.keys({
  ls: 1, cd: 1, cat: 1, grep: 1, clear: 1,
  help: 1, pwd: 1, whoami: 1, echo: 1, theme: 1, history: 1,
});

export const commandDescriptions: Record<string, string> = {
  ls: 'list directory contents',
  cd: 'change the working directory',
  cat: 'preview files (md, images, text)',
  grep: 'search for patterns (-i -n -r -t)',
  clear: 'clear the terminal screen',
  help: 'display this help message',
  pwd: 'print working directory',
  whoami: 'display user profile',
  echo: 'display a line of text',
  theme: 'change terminal color theme',
  history: 'display command history',
};
