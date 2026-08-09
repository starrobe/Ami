import { useRef, useCallback } from 'react';
import type { Terminal as XTermType } from '@xterm/xterm';

export function useAutosuggest(
  xtermRef: React.RefObject<XTermType | null>,
  inputBufferRef: React.RefObject<string>,
  historyRef: React.RefObject<string[]>,
) {
  const suggestionRef = useRef('');

  const showSuggestion = useCallback(() => {
    const term = xtermRef.current;
    if (!term) return;

    // Clear previous suggestion if any
    if (suggestionRef.current) {
      term.write(' '.repeat(suggestionRef.current.length));
      term.write('\b'.repeat(suggestionRef.current.length));
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
        term.write('\b'.repeat(suffix.length));
        return;
      }
    }
  }, [xtermRef, inputBufferRef, historyRef]);

  const clearSuggestion = useCallback(() => {
    const term = xtermRef.current;
    if (!term || !suggestionRef.current) return;
    term.write(' '.repeat(suggestionRef.current.length));
    term.write('\b'.repeat(suggestionRef.current.length));
    suggestionRef.current = '';
  }, [xtermRef]);

  const acceptSuggestion = useCallback(() => {
    const sug = suggestionRef.current;
    if (!sug) return '';
    suggestionRef.current = '';
    return sug;
  }, []);

  return { suggestionRef, showSuggestion, clearSuggestion, acceptSuggestion };
}
