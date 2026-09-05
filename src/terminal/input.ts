import type { Terminal as XTermType } from '@xterm/xterm';
import type { DirNode } from '../types';
import type { ProcessManager } from '../process/manager';
import { stringWidth, charWidth } from '../utils/charWidth';
import { promptString } from './prompt';
import { computeCandidates, findCommonPrefix, formatMatchList } from './completion';

export interface TabCycle {
  baseBuffer: string;
  matches: string[];
  index: number;
  prefix: string;
  prefixStart: number;
  lastWritten: string;
  suffixFn: (m: string) => string;
}

export interface InputHandlerDeps {
  term: XTermType;
  inputBufferRef: { current: string };
  cursorPosRef: { current: number };
  historyIndexRef: { current: number };
  suggestionRef: { current: string };
  tabCycle: { current: TabCycle | null };
  historyRef: { current: string[] };
  cwdRef: { current: string };
  fsRef: { current: DirNode };
  processManagerRef: { current: ProcessManager };
  executeCommand: (input: string) => void;
  suspendForeground: () => void;
  interruptForeground: () => void;
  showSuggestion: () => void;
  openPalette: () => void;
}

/**
 * Builds the terminal's `onData` key handler. All editing helpers and the
 * keybinding dispatch live here, isolated from the hook's lifecycle code.
 */
export function createInputHandler(deps: InputHandlerDeps): (data: string) => void {
  const {
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
    openPalette,
  } = deps;

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

  return (data: string) => {
    // While a panel is open (a foreground process exists), the shell does not
    // accept input — only Ctrl+Z (suspend) and Ctrl+C (terminate) are handled.
    if (processManagerRef.current.getForeground() !== null && data !== '\x1a' && data !== '\x03') {
      return;
    }

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

    // Handle Ctrl+L (clear screen and redraw prompt + current input)
    if (data === '\x0c') {
      const displayPath = cwdRef.current.replace('/home/user', '~');
      term.write('\x1b[2J\x1b[H' + promptString(displayPath));
      term.write(inputBufferRef.current);
      const back = stringWidth(inputBufferRef.current.slice(cursorPosRef.current));
      if (back > 0) term.write('\b'.repeat(back));
      return;
    }

    // Handle Ctrl+Z (suspend foreground process to background)
    if (data === '\x1a') {
      suspendForeground();
      return;
    }

    // Handle Ctrl+C (terminate foreground process)
    if (data === '\x03') {
      interruptForeground();
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

    // Handle Ctrl+P (open the search palette)
    if (data === '\x10') {
      openPalette();
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
      }

      // Build new completion
      tabCycle.current = null;
      const candidates = computeCandidates({ buffer, cwd: cwdRef.current, fs: fsRef.current });
      if (!candidates) return;

      const matchList = candidates.matches;
      if (matchList.length === 0) return;

      // Common prefix completion (no cycling)
      const common = findCommonPrefix(matchList);
      if (matchList.length > 1 && common.length > candidates.matchPrefix.length && candidates.matchPrefix.length > 0) {
        const toInsert = common.slice(candidates.matchPrefix.length);
        inputBufferRef.current += toInsert;
        cursorPosRef.current += toInsert.length;
        term.write(toInsert);
        return;
      }

      const suffixFn = candidates.buildSuffix!;

      // Show match list below prompt (no highlight on first display)
      if (matchList.length > 1) {
        term.write('\x1b[s\r\n' + formatMatchList(matchList, -1, term.cols) + '\x1b[u');
      }

      tabCycle.current = {
        baseBuffer: buffer,
        matches: matchList,
        index: -1,
        prefix: candidates.partial,
        prefixStart: candidates.prefixStart,
        lastWritten: '',
        suffixFn: suffixFn!,
      };

      // Single match — complete immediately, no list display
      if (matchList.length === 1) {
        const chosen = matchList[0];
        const fullText = candidates.partial + suffixFn!(chosen);
        const erase = candidates.partial.length > 0 ? '\b \b'.repeat(stringWidth(candidates.partial)) : '';
        inputBufferRef.current = buffer.slice(0, candidates.prefixStart) + fullText;
        cursorPosRef.current = inputBufferRef.current.length;
        term.write(erase + fullText);
        tabCycle.current = null;
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
  };
}
