import { useRef, useCallback, useState, useEffect } from 'react';
import type { Terminal as XTermType } from '@xterm/xterm';
import type { DirNode, RichContent } from '../types';
import { createInitialFS } from '../fs/filesystem';
import { appVersion } from '../config';
import { stringWidth } from '../utils/charWidth';
import { useSyncedRef } from '../hooks/useSyncedRef';
import { parseCommand } from '../commands/parser';
import { createCommandRegistry } from '../commands/register';
import { getTheme } from '../themes/themes';
import { createProcessManager } from '../process/manager';
import type { ProcessManager } from '../process/manager';
import { PanelProcess } from '../process/panelProcess';
import { promptString } from './prompt';
import { createInputHandler } from './input';
import type { TabCycle } from './input';

const MAX_HISTORY = 100;

export interface TerminalState {
  cwd: string;
  theme: string;
  history: string[];
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
  const processManagerRef = useRef<ProcessManager>(createProcessManager());
  const tabCycle = useRef<TabCycle | null>(null);

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
    term.write('\r\n' + promptString(displayPath));
    term.scrollToBottom();
    term.focus();
  }, [cwdRef]);

  const appendOutput = useCallback((text: string) => {
    xtermRef.current?.write(text);
  }, []);

  const setCwd = useCallback((path: string) => {
    cwdRef.current = path;
    setState(prev => ({ ...prev, cwd: path }));
  }, [cwdRef]);

  const setTheme = useCallback((name: string) => {
    themeRef.current = name;
    setState(prev => ({ ...prev, theme: name }));
  }, [themeRef]);

  const spawnPanel = useCallback((name: string, rich: RichContent): PanelProcess => {
    return processManagerRef.current.spawn(
      (pid, notify) => new PanelProcess(pid, name, rich, notify)
    ) as PanelProcess;
  }, []);

  const suspendForeground = useCallback(() => {
    const pm = processManagerRef.current;
    const fg = pm.getForeground();
    if (fg) {
      pm.signal(fg.pid, 'SIGSTOP');
      xtermRef.current?.write(`^Z\r\n[1]+  Stopped   ${fg.name}\r\n`);
    } else {
      xtermRef.current?.write('^Z\r\n');
    }
    suggestionRef.current = '';
    inputBufferRef.current = '';
    cursorPosRef.current = 0;
    writePrompt();
  }, [writePrompt]);

  const interruptForeground = useCallback(() => {
    const pm = processManagerRef.current;
    const fg = pm.getForeground();
    if (fg) pm.signal(fg.pid, 'SIGINT');
    xtermRef.current?.write('^C\r\n');
    suggestionRef.current = '';
    inputBufferRef.current = '';
    cursorPosRef.current = 0;
    writePrompt();
  }, [writePrompt]);

  const focusTerminal = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  const [, forceRender] = useState(0);
  useEffect(() => {
    return processManagerRef.current.subscribe(() => forceRender((n) => n + 1));
  }, []);

  // A foreground panel is "open" when the manager has a foreground process.
  const panelOpen = processManagerRef.current.getForeground() !== null;

  // Stop the cursor blinking while a panel is open (the terminal is not
  // accepting input then).
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.cursorBlink = !panelOpen;
  }, [panelOpen]);

  // Cache the populated registry
  const registryRef = useRef<ReturnType<typeof createCommandRegistry> | null>(null);
  const getRegistry = useCallback(() => {
    if (!registryRef.current) {
      registryRef.current = createCommandRegistry(
        () => historyRef.current,
        () => prevCwdRef.current,
        (p: string) => { prevCwdRef.current = p; }
      );
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

    const registry = getRegistry();

    // Build context using refs for current values
    const ctx = {
      cwd: cwdRef.current,
      fs: fsRef.current,
      setCwd,
      appendOutput,
      manager: processManagerRef.current,
      spawnPanel,
      theme: themeRef.current,
      setTheme,
      termCols: term.cols,
    };

    const result = registry.execute(ctx, parsed);

    if (result) {
      term.write(result);
    }

    writePrompt();
  }, [appendOutput, setCwd, setTheme, spawnPanel, writePrompt, getRegistry, historyRef, cwdRef, themeRef]);

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

    // Input handling (keybindings, line editing, tab completion)
    term.onData(createInputHandler({
      term,
      inputBufferRef,
      cursorPosRef,
      historyIndexRef,
      suggestionRef,
      tabCycle,
      historyRef,
      cwdRef,
      fsRef,
      processManagerRef,
      executeCommand,
      suspendForeground,
      interruptForeground,
      showSuggestion,
    }));

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
  }, [executeCommand, writePrompt, historyRef, cwdRef, showSuggestion, suspendForeground, interruptForeground]);

  return {
    containerRef,
    initTerminal,
    state,
    manager: processManagerRef.current,
    focusTerminal,
    suspendForeground,
    interruptForeground,
  };
}
