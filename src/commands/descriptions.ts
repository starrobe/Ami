// Commands that accept file/directory arguments (for tab completion)
export const fileArgCommands = ['cat', 'cd', 'ls'];

// Known flags per command (for tab completion)
export const commandFlags: Record<string, string[]> = {
  ls: ['-l', '-a'],
  echo: ['-n'],
  kill: ['-9'],
};

export const commandNames = [
  'ls', 'cd', 'cat', 'palette', 'clear',
  'help', 'pwd', 'whoami', 'echo', 'theme', 'history',
  'jobs', 'fg', 'bg', 'kill', 'ps',
];

export const commandDescriptions: Record<string, string> = {
  ls: 'list directory contents',
  cd: 'change the working directory',
  cat: 'preview files (md, images, text)',
  palette: 'open the search palette (blogs / tags)',
  clear: 'clear the terminal screen',
  help: 'display this help message',
  pwd: 'print working directory',
  whoami: 'display user profile',
  echo: 'display a line of text',
  theme: 'change terminal color theme',
  history: 'display command history',
  jobs: 'list background jobs',
  fg: 'bring a job to the foreground (%n)',
  bg: 'resume a job in the background (%n)',
  kill: 'terminate a process or job ([-9] pid|%n)',
  ps: 'list all processes',
};
