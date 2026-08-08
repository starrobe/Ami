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

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let common = strings[0];
  for (let i = 1; i < strings.length; i++) {
    let j = 0;
    while (j < common.length && j < strings[i].length && common[j] === strings[i][j]) {
      j++;
    }
    common = common.slice(0, j);
  }
  return common;
}

function formatMatchList(matches: string[], selectedIndex: number): string {
  return matches.map((m, i) => i === selectedIndex ? '\x1b[7m' + m + '\x1b[0m' : m).join('  ');
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
  const cursorPosRef = useRef(0);
  const historyIndexRef = useRef(-1);
  const prevCwdRef = useRef('/home/user');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tab-completion cycle state
  const tabCycle = useRef<{
    baseBuffer: string;
    matches: string[];
    index: number;
    prefix: string;
    prefixStart: number;
    isCommand: boolean;
    lastWritten: string;
    suffixFn: (m: string) => string;
  } | null>(null);

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
    if (!['cat', 'whoami'].includes(parsed.cmd)) {
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
      // Reset tab-cycle state on any non-Tab/non-ShiftTab key
      if (data !== '\t' && data !== '\x1b[Z') {
        if (tabCycle.current) {
          // Clear the match list displayed below the prompt
          term.write('\x1b[s\x1b[B\r\x1b[2K\x1b[u');
        }
        tabCycle.current = null;
      }

      // Handle Enter
      if (data === '\r') {
        const input = inputBufferRef.current;
        term.write('\r\n');
        executeCommand(input);
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        historyIndexRef.current = -1;
        return;
      }

      // Handle Backspace
      if (data === '\x7f') {
        const buf = inputBufferRef.current;
        const pos = cursorPosRef.current;
        if (pos > 0) {
          const after = buf.slice(pos);
          inputBufferRef.current = buf.slice(0, pos - 1) + after;
          cursorPosRef.current = pos - 1;
          term.write('\x1b[?25l\b' + after + ' ');
          for (let i = 0; i <= after.length; i++) term.write('\b');
          term.write('\x1b[?25h');
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
        cursorPosRef.current = 0;
        writePrompt();
        return;
      }

      // Handle Ctrl+U (clear line)
      if (data === '\x15') {
        const buf = inputBufferRef.current;
        for (let i = 0; i < buf.length; i++) term.write('\b \b');
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        return;
      }

      // Handle Ctrl+W (delete word)
      if (data === '\x17') {
        const buf = inputBufferRef.current;
        const pos = cursorPosRef.current;
        const before = buf.slice(0, pos).replace(/\s+$/, '');
        const lastSpace = before.lastIndexOf(' ');
        const deleteFrom = lastSpace === -1 ? 0 : lastSpace + 1;
        inputBufferRef.current = buf.slice(0, deleteFrom) + buf.slice(pos);
        cursorPosRef.current = deleteFrom;
        term.write('\x1b[?25l\b'.repeat(pos - deleteFrom) + buf.slice(pos) + ' ');
        for (let i = 0; i <= buf.slice(pos).length; i++) term.write('\b');
        term.write('\x1b[?25h');
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
        cursorPosRef.current = inputBufferRef.current.length;
        return;
      }

      // Handle arrow down (history)
      if (data === '\x1b[B') {
        const history = historyRef.current;
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
        cursorPosRef.current = inputBufferRef.current.length;
        return;
      }

      // Handle arrow left
      if (data === '\x1b[D') {
        if (cursorPosRef.current > 0) {
          cursorPosRef.current--;
          term.write('\b');
        }
        return;
      }

      // Handle arrow right — echo char under cursor to advance
      if (data === '\x1b[C') {
        const len = inputBufferRef.current.length;
        if (cursorPosRef.current < len) {
          term.write(inputBufferRef.current[cursorPosRef.current]);
          cursorPosRef.current++;
        }
        return;
      }

      // Handle Shift+Tab (cycle backwards)
      if (data === '\x1b[Z') {
        const prev = tabCycle.current;
        if (prev) {
          // First selection after display
          const isFirstSelect = prev.index === -1;
          if (isFirstSelect) {
            prev.index = 0;
          } else {
            prev.index = (prev.index - 1 + prev.matches.length) % prev.matches.length;
          }

          const erase = isFirstSelect
            ? '\b \b'.repeat(prev.prefix.length)
            : '\b \b'.repeat(prev.lastWritten.length);
          inputBufferRef.current = prev.baseBuffer;
          cursorPosRef.current = prev.baseBuffer.length;
          const chosen = prev.matches[prev.index];
          const fullText = prev.prefix + prev.suffixFn(chosen);
          inputBufferRef.current = prev.baseBuffer.slice(0, prev.prefixStart) + fullText;
          cursorPosRef.current = inputBufferRef.current.length;
          const matchLine = '\x1b[s\x1b[B\r\x1b[2K' + formatMatchList(prev.matches, prev.index) + '\x1b[u';
          term.write(matchLine + erase + fullText);
          prev.lastWritten = fullText;
        }
        return;
      }

      // Handle Tab (autocomplete with cycling)
      if (data === '\t') {
        const buffer = inputBufferRef.current;
        if (buffer.length === 0) return;

        const prev = tabCycle.current;

        // Check if continuing a previous cycle
        if (prev && buffer.startsWith(prev.baseBuffer)) {
          // First selection after display (index -1 → 0)
          const isFirstSelect = prev.index === -1;
          if (isFirstSelect) {
            prev.index = 0;
          } else {
            prev.index = (prev.index + 1) % prev.matches.length;
          }

          const erase = isFirstSelect
            ? '\b \b'.repeat(prev.prefix.length)
            : '\b \b'.repeat(prev.lastWritten.length);
          inputBufferRef.current = prev.baseBuffer;
          cursorPosRef.current = prev.baseBuffer.length;

          const chosen = prev.matches[prev.index];
          const fullText = prev.prefix + prev.suffixFn(chosen);
          inputBufferRef.current = prev.baseBuffer.slice(0, prev.prefixStart) + fullText;
          cursorPosRef.current = inputBufferRef.current.length;

          // Redraw match list with highlight
          const matchLine = '\x1b[s\x1b[B\r\x1b[2K' + formatMatchList(prev.matches, prev.index) + '\x1b[u';
          term.write(matchLine + erase + fullText);
          prev.lastWritten = fullText;
          return;
        } else {
          // --- Build new completion ---
          tabCycle.current = null;

          const rawTokens = buffer.split(/\s+/);
          const tokens = rawTokens.filter(t => t.length > 0);
          const trailingSpace = /\s$/.test(buffer);
          const isCommand = tokens.length === 0 || (tokens.length === 1 && !trailingSpace);
          const partial = trailingSpace ? '' : (tokens.length > 0 ? tokens[tokens.length - 1] : '');
          const prefixStart = buffer.length - partial.length;

          let matchList: string[] = [];
          let buildSuffix: ((m: string) => string) | null = null;
          let matchPrefix = '';  // the part being matched (last path segment or full command)

          if (isCommand) {
            const cmdNames = ['cat', 'cd', 'clear', 'echo', 'grep', 'help', 'history', 'ls', 'pwd', 'theme', 'whoami'];
            matchPrefix = partial.toLowerCase();
            matchList = cmdNames.filter(c => c.startsWith(matchPrefix));
            buildSuffix = (m: string) => m.slice(matchPrefix.length) + ' ';
          } else {
            // Commands that don't take file arguments — skip path completion
            const cmd = tokens[0]?.toLowerCase();
            if (cmd && !['cat', 'cd', 'ls', 'grep'].includes(cmd)) return;
            try {
              const pathSegs = partial.split('/');
              matchPrefix = pathSegs[pathSegs.length - 1] || '';
              const dirPart = pathSegs.slice(0, -1).join('/');
              const resolvedDir = resolvePath(fsRef.current, cwdRef.current, dirPart || '.');
              const dirNode = getNode(fsRef.current, resolvedDir);
              if (dirNode && dirNode.type === 'dir') {
                const children = Object.keys(dirNode.children);
                matchList = children.filter(c => c.startsWith(matchPrefix));
                const basePath = pathSegs.slice(0, -1).join('/');
                buildSuffix = (m: string) => {
                  const entry = dirNode.children[m];
                  const sfx = entry.type === 'dir' ? '/' : '';
                  const fullMatch = (basePath ? basePath + '/' : '') + m + sfx;
                  return fullMatch.slice(partial.length);
                };
              }
            } catch { /* ignore */ }
          }

          if (matchList.length === 0) return;

          // Common prefix completion (no cycling)
          const common = findCommonPrefix(matchList);
          if (matchList.length > 1 && common.length > matchPrefix.length && matchPrefix.length > 0) {
            const toInsert = common.slice(matchPrefix.length);
            inputBufferRef.current += toInsert;
            term.write(toInsert);
            return;
          }

          // Show match list below prompt (no highlight on first display)
          const suffixFn = buildSuffix!;
          if (matchList.length > 1) {
            term.write('\x1b[s\r\n' + matchList.join('  ') + '\x1b[u');
          }

          tabCycle.current = {
            baseBuffer: buffer,
            matches: matchList,
            index: -1,  // -1 = displayed but not yet selected
            prefix: partial,
            prefixStart,
            isCommand,
            lastWritten: '',
            suffixFn: suffixFn!,
          };

          // Single match — complete immediately, no list display
          if (matchList.length === 1) {
            const chosen = matchList[0];
            const fullText = partial + suffixFn!(chosen);
            const erase = partial.length > 0 ? '\b \b'.repeat(partial.length) : '';
            inputBufferRef.current = buffer.slice(0, prefixStart) + fullText;
            cursorPosRef.current = inputBufferRef.current.length;
            term.write(erase + fullText);
            tabCycle.current = null;
          }
        }
        return;
      }

      // Normal character input
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        const buf = inputBufferRef.current;
        const pos = cursorPosRef.current;
        inputBufferRef.current = buf.slice(0, pos) + data + buf.slice(pos);
        cursorPosRef.current = pos + 1;
        term.write('\x1b[?25l' + data + buf.slice(pos));
        for (let i = 0; i < buf.length - pos; i++) term.write('\b');
        term.write('\x1b[?25h');
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
    term.write('\x1b[37m');
    term.writeln('   ___           _');
    term.writeln('  / _ \\         (_)');
    term.writeln(' / /_\\ \\_ __ ___ _');
    term.writeln(' |  _  | \'  \\  \\ |');
    term.writeln(' | | | | | | |\\ \\ |');
    term.writeln(' \\_| |_/_| |_/__/ |');
    term.writeln('               __/ |');
    term.writeln('              |___/');
    term.write('\x1b[0m');
    term.writeln('');
    term.writeln('Welcome to Ami Terminal v1.0.0');
    term.write('Type \x1b[37mhelp\x1b[0m to see available commands.');
    term.writeln('');

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
