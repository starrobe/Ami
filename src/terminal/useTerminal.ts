import { useRef, useCallback, useState, useEffect } from 'react';
import type { Terminal as XTermType } from '@xterm/xterm';
import type { DirNode } from '../types';
import type { ReactNode } from 'react';
import { createInitialFS, resolvePath, getNode } from '../fs/filesystem';
import { getUserName, appVersion } from '../config';
import { formatColumns } from '../utils/columnLayout';
import { stringWidth, charWidth } from '../utils/charWidth';
import { commandNames, fileArgCommands, commandFlags } from '../commands/descriptions';
import { useSyncedRef } from '../hooks/useSyncedRef';
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

const MAX_HISTORY = 100;

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

function formatMatchList(matches: string[], selectedIndex: number, termCols: number): string {
  return formatColumns(matches, termCols, 9, 8, selectedIndex);
}

// xterm doesn't expose the cell height publicly; read the internal render
// service dimensions so touch scrolling can convert pixels → lines.
// Falls back to 20px when the internal layout is unavailable.
function getCellHeight(term: XTermType): number {
  const internal = term as unknown as {
    _core?: { _renderService?: { dimensions?: { css?: { cell?: { height?: number } } } } };
  };
  return internal._core?._renderService?.dimensions?.css?.cell?.height || 20;
}

export function useTerminal() {
  const xtermRef = useRef<XTermType | null>(null);
  const initGenRef = useRef(0);
  const [state, setState] = useState<TerminalState>({
    cwd: '/home/user',
    theme: 'default',
    history: [],
    richContent: null,
  });

  // Refs synced with state to avoid stale closure in onData handler
  const cwdRef = useSyncedRef(state.cwd);
  const historyRef = useSyncedRef(state.history);
  const themeRef = useSyncedRef(state.theme);

  const fsRef = useRef<DirNode>(createInitialFS());
  const inputBufferRef = useRef('');
  const cursorPosRef = useRef(0);
  const historyIndexRef = useRef(-1);
  const prevCwdRef = useRef('/home/user');
  const suggestionRef = useRef('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const showSuggestion = useCallback(() => {
    const term = xtermRef.current;
    if (!term) return;

    // Clear previous suggestion if any
    if (suggestionRef.current) {
      term.write('\x1b[K');
      suggestionRef.current = '';
    }

    const input = inputBufferRef.current;
    if (input.length === 0) return;

    // Search history for a match
    const history = historyRef.current;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].startsWith(input) && history[i].length > input.length) {
        const suffix = history[i].slice(input.length);
        suggestionRef.current = suffix;
        term.write('\x1b[2m' + suffix + '\x1b[0m');
        term.write('\b'.repeat(stringWidth(suffix)));
        return;
      }
    }
    suggestionRef.current = '';
  }, [historyRef]);

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
    term.write('\r\n\x1b[37m' + getUserName() + '@ami\x1b[0m:\x1b[37m' + displayPath + '\x1b[0m $ ');
    term.scrollToBottom();
    term.focus();
  }, [cwdRef]);

  const appendOutput = useCallback((text: string) => {
    xtermRef.current?.write(text);
  }, []);

  const setRichContent = useCallback((node: ReactNode | null) => {
    setState(prev => ({ ...prev, richContent: node }));
  }, []);

  const setCwd = useCallback((path: string) => {
    cwdRef.current = path;
    setState(prev => ({ ...prev, cwd: path }));
  }, [cwdRef]);

  const setTheme = useCallback((name: string) => {
    themeRef.current = name;
    setState(prev => ({ ...prev, theme: name }));
  }, [themeRef]);

  // Cache the populated registry
  const registryRef = useRef<ReturnType<typeof createRegistry> | null>(null);
  const getRegistry = useCallback(() => {
    if (!registryRef.current) {
      const registry = createRegistry();
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
      registryRef.current = registry;
    }
    return registryRef.current;
  }, [historyRef]);

  const executeCommand = useCallback((input: string) => {
    const term = xtermRef.current;
    if (!term) return;

    const parsed = parseCommand(input);
    if (!parsed) {
      writePrompt();
      return;
    }

    // Update history via ref then sync state (bounded to avoid unbounded growth)
    historyRef.current = [...historyRef.current, input].slice(-MAX_HISTORY);
    setState(prev => ({
      ...prev,
      history: historyRef.current,
    }));

    // Clear rich content for non-cat commands
    if (!['cat', 'whoami'].includes(parsed.cmd)) {
      setRichContent(null);
    }

    const registry = getRegistry();

    // Build context using refs for current values
    const ctx = {
      cwd: cwdRef.current,
      fs: fsRef.current,
      setCwd,
      appendOutput,
      setRichContent,
      theme: themeRef.current,
      setTheme,
      termCols: term.cols,
    };

    const result = registry.execute(ctx, parsed);

    if (result) {
      term.write(result);
    }

    writePrompt();
  }, [appendOutput, setCwd, setTheme, setRichContent, writePrompt, getRegistry, historyRef, cwdRef, themeRef]);

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
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Noto Sans Mono CJK SC', 'Microsoft YaHei', 'PingFang SC', monospace",
      fontSize: window.innerWidth < 768 ? 13 : 16,
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

    // --- Input editing helpers (only touch refs; stable across renders) ---
    const clearInput = () => {
      while (inputBufferRef.current.length > 0) {
        const last = inputBufferRef.current.slice(-1);
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        term.write('\b \b'.repeat(charWidth(last)));
      }
      cursorPosRef.current = 0;
    };

    const setInput = (text: string) => {
      clearInput();
      inputBufferRef.current = text;
      term.write(text);
      cursorPosRef.current = text.length;
    };

    // Delete buffer range [deleteFrom, pos) and redraw the tail at the cursor
    const eraseRange = (deleteFrom: number, pos: number) => {
      const tail = inputBufferRef.current.slice(pos);
      const deleted = inputBufferRef.current.slice(deleteFrom, pos);
      inputBufferRef.current = inputBufferRef.current.slice(0, deleteFrom) + tail;
      cursorPosRef.current = deleteFrom;
      const delWidth = stringWidth(deleted);
      const tailWidth = stringWidth(tail);
      term.write('\x1b[?25l' + '\b'.repeat(delWidth) + tail + ' ');
      for (let i = 0; i <= tailWidth; i++) term.write('\b');
      term.write('\x1b[?25h');
    };

    // Cycle the tab-completion selection by dir (-1 = Shift+Tab, +1 = Tab).
    // Returns false when no completion cycle is in progress.
    const cycleCompletion = (dir: 1 | -1): boolean => {
      const prev = tabCycle.current;
      if (!prev) return false;

      const isFirstSelect = prev.index === -1;
      prev.index = isFirstSelect
        ? 0
        : (prev.index + dir + prev.matches.length) % prev.matches.length;

      const erase = '\b \b'.repeat(isFirstSelect ? stringWidth(prev.prefix) : stringWidth(prev.lastWritten));
      const chosen = prev.matches[prev.index];
      const fullText = prev.prefix + prev.suffixFn(chosen);
      inputBufferRef.current = prev.baseBuffer.slice(0, prev.prefixStart) + fullText;
      cursorPosRef.current = inputBufferRef.current.length;
      const matchLine = '\x1b[s\x1b[B\r\x1b[2K' + formatMatchList(prev.matches, prev.index, term.cols) + '\x1b[u';
      term.write(matchLine + erase + fullText);
      prev.lastWritten = fullText;
      return true;
    };

    // Handle input
    term.onData((data) => {
      // Reset tab-cycle state on any non-Tab/non-ShiftTab key
      if (data !== '\t' && data !== '\x1b[Z') {
        if (tabCycle.current) {
          // Clear match list — may span multiple lines with column layout
          term.write('\x1b[s\x1b[B\r\x1b[J\x1b[u');
        }
        tabCycle.current = null;
      }

      // Handle Enter
      if (data === '\r') {
        suggestionRef.current = '';
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
        const pos = cursorPosRef.current;
        if (pos > 0) {
          eraseRange(pos - 1, pos);
          showSuggestion();
        }
        return;
      }

      // Handle Ctrl+L (clear screen, only when no input)
      if (data === '\x0c') {
        if (inputBufferRef.current.length === 0) {
          setRichContent(null);
          term.write('\x1b[2J\x1b[H');
          writePrompt();
        }
        return;
      }

      // Handle Ctrl+C
      if (data === '\x03') {
        suggestionRef.current = '';
        term.write('^C\r\n');
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        writePrompt();
        return;
      }

      // Handle Ctrl+U (clear line)
      if (data === '\x15') {
        clearInput();
        return;
      }

      // Handle Ctrl+W (delete word)
      if (data === '\x17') {
        const buf = inputBufferRef.current;
        const pos = cursorPosRef.current;
        const before = buf.slice(0, pos).replace(/\s+$/, '');
        const lastSpace = before.lastIndexOf(' ');
        const deleteFrom = lastSpace === -1 ? 0 : lastSpace + 1;
        eraseRange(deleteFrom, pos);
        return;
      }

      // Handle arrow up (history)
      if (data === '\x1b[A') {
        suggestionRef.current = '';
        const history = historyRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          historyIndexRef.current = history.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
        }
        setInput(history[historyIndexRef.current]);
        return;
      }

      // Handle arrow down (history)
      if (data === '\x1b[B') {
        suggestionRef.current = '';
        const history = historyRef.current;
        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current++;
          setInput(history[historyIndexRef.current]);
        } else {
          historyIndexRef.current = -1;
          setInput('');
        }
        return;
      }

      // Handle arrow left
      if (data === '\x1b[D') {
        if (cursorPosRef.current > 0) {
          const prevChar = inputBufferRef.current[cursorPosRef.current - 1];
          cursorPosRef.current--;
          term.write('\b'.repeat(charWidth(prevChar)));
        }
        return;
      }

      // Handle arrow right — accept suggestion at end, or move within text
      if (data === '\x1b[C') {
        const buf = inputBufferRef.current;
        if (cursorPosRef.current === buf.length && suggestionRef.current) {
          // Accept suggestion
          const sug = suggestionRef.current;
          suggestionRef.current = '';
          term.write('\x1b[0m' + sug);
          inputBufferRef.current = buf + sug;
          cursorPosRef.current = buf.length + sug.length;
        } else if (cursorPosRef.current < buf.length) {
          term.write(buf[cursorPosRef.current]);
          cursorPosRef.current++;
        }
        return;
      }

      // Handle Shift+Tab (cycle backwards)
      if (data === '\x1b[Z') {
        cycleCompletion(-1);
        return;
      }

      // Handle Tab (autocomplete with cycling)
      if (data === '\t') {
        const buffer = inputBufferRef.current;
        if (buffer.length === 0) return;

        suggestionRef.current = '';
        const prev = tabCycle.current;

        // Check if continuing a previous cycle
        if (prev && buffer.startsWith(prev.baseBuffer)) {
          cycleCompletion(1);
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
            matchPrefix = partial.toLowerCase();
            matchList = commandNames.filter(c => c.startsWith(matchPrefix));
            buildSuffix = (m: string) => m.slice(matchPrefix.length) + ' ';
          } else {
            // Flag completion — when partial starts with '-'
            if (partial.startsWith('-')) {
              const cmd = tokens[0]?.toLowerCase();
              const flags = commandFlags[cmd] || [];
              matchList = flags.filter(f => f.startsWith(partial));
              matchPrefix = partial;
              buildSuffix = (m: string) => m.slice(matchPrefix.length) + ' ';
              // fall through to normal completion flow below
            } else {
            // Commands that don't take file arguments — skip path completion
            const cmd = tokens[0]?.toLowerCase();
            if (cmd && !fileArgCommands.includes(cmd)) return;
            try {
              const pathSegs = partial.split('/');
              matchPrefix = pathSegs[pathSegs.length - 1] || '';
              const dirPart = pathSegs.slice(0, -1).join('/');
              const resolvedDir = resolvePath(cwdRef.current, dirPart || '.');
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
        }

          if (matchList.length === 0) return;

          // Common prefix completion (no cycling)
          const common = findCommonPrefix(matchList);
          if (matchList.length > 1 && common.length > matchPrefix.length && matchPrefix.length > 0) {
            const toInsert = common.slice(matchPrefix.length);
            inputBufferRef.current += toInsert;
            cursorPosRef.current += toInsert.length;
            term.write(toInsert);
            return;
          }

          // Show match list below prompt (no highlight on first display)
          const suffixFn = buildSuffix!;
          if (matchList.length > 1) {
            term.write('\x1b[s\r\n' + formatMatchList(matchList, -1, term.cols) + '\x1b[u');
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
            const erase = partial.length > 0 ? '\b \b'.repeat(stringWidth(partial)) : '';
            inputBufferRef.current = buffer.slice(0, prefixStart) + fullText;
            cursorPosRef.current = inputBufferRef.current.length;
            term.write(erase + fullText);
            tabCycle.current = null;
          }
        }
        return;
      }

      // Normal character input (supports IME multi-character commits)
      if (data.length >= 1 && data.charCodeAt(0) >= 32) {
        const buf = inputBufferRef.current;
        const pos = cursorPosRef.current;
        const tail = buf.slice(pos);

        inputBufferRef.current = buf.slice(0, pos) + data + tail;
        cursorPosRef.current = pos + data.length;
        term.write('\x1b[?25l' + data + tail);
        for (let i = 0; i < stringWidth(tail); i++) term.write('\b');
        term.write('\x1b[?25h');
        showSuggestion();
      }
    });

    // Touch scroll with momentum (xterm.js lacks native touch scroll)
    let touchY = 0, velocity = 0, lastTime = 0, momentumRaf = 0;
    const lineHeight = getCellHeight(term);

    const stopMomentum = () => {
      if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = 0; }
    };
    const onTouchStart = (e: TouchEvent) => {
      stopMomentum();
      touchY = e.touches[0].clientY;
      velocity = 0;
      lastTime = Date.now();
    };
    const onTouchMove = (e: TouchEvent) => {
      const now = Date.now();
      const newY = e.touches[0].clientY;
      const dy = touchY - newY;
      velocity = (dy / Math.max(now - lastTime, 1)) * 16;
      touchY = newY;
      lastTime = now;
      term.scrollLines(Math.round(dy / lineHeight));
      e.preventDefault();
    };
    const onTouchEnd = () => {
      const decay = () => {
        if (Math.abs(velocity) < 0.5) { stopMomentum(); return; }
        const lines = Math.round(velocity / lineHeight);
        if (lines !== 0) term.scrollLines(lines);
        velocity *= 0.95;
        momentumRaf = requestAnimationFrame(decay);
      };
      momentumRaf = requestAnimationFrame(decay);
    };

    term.element?.addEventListener('touchstart', onTouchStart, { passive: true });
    term.element?.addEventListener('touchmove', onTouchMove, { passive: false });
    term.element?.addEventListener('touchend', onTouchEnd, { passive: true });

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
    term.writeln('');
    term.writeln(`Welcome to Ami Terminal v${appVersion}`);
    term.writeln('Type \x1b[37mhelp\x1b[0m to see available commands.');
    term.writeln('');

    writePrompt();

    return () => {
      stopMomentum();
      term.element?.removeEventListener('touchstart', onTouchStart);
      term.element?.removeEventListener('touchmove', onTouchMove);
      term.element?.removeEventListener('touchend', onTouchEnd);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [executeCommand, writePrompt, setRichContent, historyRef, cwdRef, showSuggestion]);

  return {
    containerRef,
    initTerminal,
    state,
    setRichContent,
  };
}
