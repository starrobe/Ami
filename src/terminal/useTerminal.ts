import { useRef, useCallback, useState, useEffect } from 'react';
import type { Terminal as XTermType } from '@xterm/xterm';
import type { DirNode } from '../types';
import type { ReactNode } from 'react';
import { createInitialFS, resolvePath, getNode } from '../fs/filesystem';
import { parseCommand } from '../commands/parser';
import { createRegistry } from '../commands/registry';
import { createHelpCommand } from '../commands/builtins/help';
import { echoCommand } from '../commands/builtins/echo';
import { clearCommand } from '../commands/builtins/clear';
import { pwdCommand } from '../commands/builtins/pwd';
import { whoamiCommand } from '../commands/builtins/whoami';
import { createHistoryCommand } from '../commands/builtins/history';
import { lsCommand } from '../commands/builtins/ls';
import { createCdCommand } from '../commands/builtins/cd';
import { grepCommand } from '../commands/builtins/grep';
import { catCommand } from '../commands/builtins/cat';
import { themeCommand } from '../commands/builtins/theme';
import { getTheme } from '../themes/themes';

export interface TerminalState {
  cwd: string;
  theme: string;
  history: string[];
  richContent: ReactNode | null;
}

export function useTerminal() {
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<any>(null);
  const initGenRef = useRef(0);
  const [state, setState] = useState<TerminalState>({
    cwd: '/home/user',
    theme: 'mono',
    history: [],
    richContent: null,
  });

  // Refs to avoid stale closure in the terminal onData handler
  const cwdRef = useRef(state.cwd);
  const historyRef = useRef(state.history);
  const themeRef = useRef(state.theme);

  // Keep refs in sync with state
  useEffect(() => { cwdRef.current = state.cwd; }, [state.cwd]);
  useEffect(() => { historyRef.current = state.history; }, [state.history]);
  useEffect(() => { themeRef.current = state.theme; }, [state.theme]);

  const fsRef = useRef<DirNode>(createInitialFS());
  const inputBufferRef = useRef('');
  const historyIndexRef = useRef(-1);
  const prevCwdRef = useRef('/home/user');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Apply theme changes to the terminal instance and page chrome
  useEffect(() => {
    const theme = getTheme(state.theme);

    // Page background and titlebar
    document.documentElement.style.setProperty('--ami-bg', theme.background);
    document.documentElement.style.setProperty('--ami-titlebar-bg', theme.black);

    const term = xtermRef.current;
    if (!term) return;
    term.options.theme = {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: theme.selection,
    };
  }, [state.theme]);

  const writePrompt = useCallback(() => {
    const term = xtermRef.current;
    if (!term) return;
    const displayPath = cwdRef.current.replace('/home/user', '~');
    term.write('\r\n\x1b[37muser@ami\x1b[0m:\x1b[37m' + displayPath + '\x1b[0m $ ');
    term.scrollToBottom();
    term.focus();
  }, []);

  const appendOutput = useCallback((text: string) => {
    xtermRef.current?.write(text);
  }, []);

  const setRichContent = useCallback((node: ReactNode | null) => {
    setState(prev => ({ ...prev, richContent: node }));
  }, []);

  const setCwd = useCallback((path: string) => {
    cwdRef.current = path;
    setState(prev => ({ ...prev, cwd: path }));
  }, []);

  const setTheme = useCallback((name: string) => {
    themeRef.current = name;
    setState(prev => ({ ...prev, theme: name }));
  }, []);

  const executeCommand = useCallback((input: string) => {
    const term = xtermRef.current;
    if (!term) return;

    const parsed = parseCommand(input);
    if (!parsed) {
      writePrompt();
      return;
    }

    // Update history via ref then sync state
    historyRef.current = [...historyRef.current, input];
    setState(prev => ({
      ...prev,
      history: historyRef.current,
    }));

    // Clear rich content for non-cat commands
    if (parsed.cmd !== 'cat') {
      setRichContent(null);
    }

    const registry = createRegistry();

    // Register all commands
    registry.register('help', createHelpCommand(registry));
    registry.register('echo', echoCommand);
    registry.register('clear', clearCommand);
    registry.register('pwd', pwdCommand);
    registry.register('whoami', whoamiCommand);
    registry.register('history', createHistoryCommand(() => historyRef.current));
    registry.register('ls', lsCommand);
    registry.register('cd', createCdCommand(
      () => prevCwdRef.current,
      (p: string) => { prevCwdRef.current = p; }
    ));
    registry.register('grep', grepCommand);
    registry.register('cat', catCommand);
    registry.register('theme', themeCommand);

    // Build context using refs for current values
    const ctx = {
      cwd: cwdRef.current,
      fs: fsRef.current,
      setCwd,
      appendOutput,
      setRichContent,
      theme: themeRef.current,
      setTheme,
    };

    const result = registry.execute(ctx, parsed);

    if (result) {
      term.write(result);
    }

    writePrompt();
  }, [appendOutput, setCwd, setTheme, setRichContent, writePrompt]);

  const initTerminal = useCallback(async () => {
    const gen = ++initGenRef.current;

    await import('@xterm/xterm/css/xterm.css');
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    // Abort if a newer initTerminal call has started (StrictMode remount)
    if (gen !== initGenRef.current) {
      return () => {};
    }

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 15,
      lineHeight: 1.5,
      theme: {
        background: '#0a0a0a',
        foreground: '#E0E0E0',
        cursor: '#FFFFFF',
        selectionBackground: 'rgba(255, 255, 255, 0.25)',
      },
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    if (containerRef.current) {
      term.open(containerRef.current);
      fitAddon.fit();
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle input
    term.onData((data) => {
      // Handle Enter
      if (data === '\r') {
        const input = inputBufferRef.current;
        term.write('\r\n');
        executeCommand(input);
        inputBufferRef.current = '';
        historyIndexRef.current = -1;
        return;
      }

      // Handle Backspace
      if (data === '\x7f') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }

      // Handle Ctrl+L (clear / form feed)
      if (data === '\x0c') {
        setRichContent(null);
        term.write('\x1b[2J\x1b[H');
        writePrompt();
        return;
      }

      // Handle Ctrl+C
      if (data === '\x03') {
        term.write('^C\r\n');
        inputBufferRef.current = '';
        writePrompt();
        return;
      }

      // Handle Ctrl+U (clear line)
      if (data === '\x15') {
        while (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }

      // Handle Ctrl+W (delete word)
      if (data === '\x17') {
        const buf = inputBufferRef.current;
        const trimmed = buf.replace(/\s+$/, '');
        const lastSpace = trimmed.lastIndexOf(' ');
        const deleteFrom = lastSpace === -1 ? 0 : lastSpace + 1;
        const deleted = buf.slice(deleteFrom);
        inputBufferRef.current = buf.slice(0, deleteFrom);
        for (let i = 0; i < deleted.length; i++) {
          term.write('\b \b');
        }
        return;
      }

      // Handle arrow up (history)
      if (data === '\x1b[A') {
        const history = historyRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          historyIndexRef.current = history.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
        }
        // Clear current input
        while (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        inputBufferRef.current = history[historyIndexRef.current];
        term.write(inputBufferRef.current);
        return;
      }

      // Handle arrow down (history)
      if (data === '\x1b[B') {
        const history = historyRef.current;
        // Clear current input
        while (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current++;
          inputBufferRef.current = history[historyIndexRef.current];
        } else {
          historyIndexRef.current = -1;
          inputBufferRef.current = '';
        }
        term.write(inputBufferRef.current);
        return;
      }

      // Handle Tab (autocomplete)
      if (data === '\t') {
        const buffer = inputBufferRef.current;
        if (buffer.length === 0) return;

        // Split without trimming to detect trailing-space empty token
        const rawTokens = buffer.split(/\s+/);
        const tokens = rawTokens.filter(t => t.length > 0);
        const trailingSpace = /\s$/.test(buffer);

        // First word is always the command; anything after is path
        const isCommand = tokens.length === 0 || (tokens.length === 1 && !trailingSpace);
        const partial = trailingSpace ? '' : (tokens.length > 0 ? tokens[tokens.length - 1] : '');

        if (isCommand) {
          // --- Command name completion ---
          const cmdNames = ['cat', 'cd', 'clear', 'echo', 'grep', 'help', 'history', 'ls', 'pwd', 'theme', 'whoami'];
          const prefix = partial.toLowerCase();
          if (!prefix) return;
          const matching = cmdNames.filter(c => c.startsWith(prefix));

          if (matching.length === 1) {
            const toInsert = matching[0].slice(prefix.length);
            inputBufferRef.current += toInsert + ' ';
            term.write(toInsert + ' ');
          } else if (matching.length > 1) {
            // Find common prefix
            let common = matching[0];
            for (let i = 1; i < matching.length; i++) {
              let j = 0;
              while (j < common.length && j < matching[i].length && common[j] === matching[i][j]) {
                j++;
              }
              common = common.slice(0, j);
            }
            if (common.length > prefix.length) {
              const toInsert = common.slice(prefix.length);
              inputBufferRef.current += toInsert;
              term.write(toInsert);
            } else {
              // Show matches
              term.write('\r\n' + matching.join('  ') + '\r\n');
              writePrompt();
              term.write(buffer);
              inputBufferRef.current = buffer;
            }
          }
        } else {
          // --- Path completion ---
          try {
            const pathSegs = partial.split('/');
            const prefix = pathSegs[pathSegs.length - 1] || '';
            const dirPart = pathSegs.slice(0, -1).join('/');
            const resolvedDir = resolvePath(fsRef.current, cwdRef.current, dirPart || '.');
            const dirNode = getNode(fsRef.current, resolvedDir);

            if (dirNode && dirNode.type === 'dir') {
              const children = Object.keys(dirNode.children);
              const matching = children.filter(c => c.startsWith(prefix));
              if (matching.length === 0) return;

              if (matching.length === 1) {
                const entry = dirNode.children[matching[0]];
                const suffix = entry.type === 'dir' ? '/' : '';
                const basePath = pathSegs.slice(0, -1).join('/');
                const fullMatch = (basePath ? basePath + '/' : '') + matching[0] + suffix;
                const toInsert = fullMatch.slice(partial.length);
                inputBufferRef.current += toInsert;
                term.write(toInsert);
              } else {
                // Find common prefix
                let common = matching[0];
                for (let i = 1; i < matching.length; i++) {
                  let j = 0;
                  while (j < common.length && j < matching[i].length && common[j] === matching[i][j]) {
                    j++;
                  }
                  common = common.slice(0, j);
                }
                if (common.length > prefix.length) {
                  const toInsert = common.slice(prefix.length);
                  inputBufferRef.current += toInsert;
                  term.write(toInsert);
                } else {
                  // Show matches
                  term.write('\r\n' + matching.join('  ') + '\r\n');
                  writePrompt();
                  term.write(buffer);
                  inputBufferRef.current = buffer;
                }
              }
            }
          } catch {
            // Ignore tab completion errors
          }
        }
        return;
      }

      // Normal character input
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    // Resize handling
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes (e.g. rich content panel)
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Write welcome message
    term.write(`\x1b[37m
   ___           _
  / _ \\         (_)
 / /_\\ \\_ __ ___ _
 |  _  | '  \\  \\ |
 | | | | | | |\\ \\ |
 \\_| |_/_| |_/__/ |
               __/ |
              |___/
\x1b[0m
Welcome to Ami Terminal v1.0.0
Type \x1b[37mhelp\x1b[0m to see available commands.

`);

    writePrompt();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [executeCommand, writePrompt, setRichContent]);

  return {
    containerRef,
    initTerminal,
    state,
    fitAddonRef,
  };
}
