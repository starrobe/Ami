import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminal } from './useTerminal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatScrollPosition } from '../utils/scrollPosition';
import './Terminal.css';

export default function Terminal() {
  const { containerRef, initTerminal, manager, focusTerminal, suspendForeground, interruptForeground } = useTerminal();
  const richBodyRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingGRef = useRef(false);
  const [scrollLabel, setScrollLabel] = useState('Top');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const richContent = manager.getForeground()?.view() ?? null;

  useEffect(() => {
    let disposed = false;
    let cleanupFn: (() => void) | undefined;

    initTerminal().then((fn) => {
      if (disposed) {
        fn?.();
      } else {
        cleanupFn = fn;
      }
    });

    return () => {
      disposed = true;
      cleanupFn?.();
    };
  }, [initTerminal]);

  // Reset scroll/search state whenever the rich content changes
  useEffect(() => {
    if (richBodyRef.current) richBodyRef.current.scrollTop = 0;
    setScrollLabel('Top');
    setSearchOpen(false);
    setSearchQuery('');
    pendingGRef.current = false;
  }, [richContent]);

  // Focus the search input when it appears
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const scrollToTop = useCallback(() => {
    if (richBodyRef.current) richBodyRef.current.scrollTop = 0;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = richBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const scrollToFirstMatch = useCallback((query: string) => {
    const root = richBodyRef.current;
    if (!root || !query) return;
    const lower = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? '';
      const idx = text.toLowerCase().indexOf(lower);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + query.length);
        const rect = range.getBoundingClientRect();
        root.scrollTop += rect.top - root.getBoundingClientRect().top - root.clientHeight / 2;
        return;
      }
    }
  }, []);

  const terminatePanel = useCallback(() => {
    const fg = manager.getForeground();
    if (fg) manager.signal(fg.pid, 'SIGTERM');
  }, [manager]);

  // Intercept pager keys while the panel is open (terminal keeps focus for commands)
  useEffect(() => {
    if (!richContent || searchOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        e.stopPropagation();
        suspendForeground();
        return;
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        e.stopPropagation();
        interruptForeground();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'q' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        pendingGRef.current = false;
        terminatePanel();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        pendingGRef.current = false;
        setSearchOpen(true);
        return;
      }
      if (e.key === 'G') {
        e.preventDefault();
        e.stopPropagation();
        pendingGRef.current = false;
        scrollToBottom();
        return;
      }
      if (e.key === 'g') {
        e.preventDefault();
        e.stopPropagation();
        if (pendingGRef.current) {
          pendingGRef.current = false;
          scrollToTop();
        } else {
          pendingGRef.current = true;
        }
        return;
      }
      pendingGRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [richContent, searchOpen, scrollToBottom, scrollToTop, terminatePanel, suspendForeground, interruptForeground]);

  return (
    <div className="terminal-shell">
      <div className="terminal-content">
        <div ref={containerRef} className="terminal-xterm" />
      </div>
      {richContent && (
        <ErrorBoundary>
          <div className="terminal-rich-backdrop">
            <div className="terminal-rich" onClick={(e) => e.stopPropagation()}>
              <div
                ref={richBodyRef}
                className="terminal-rich-body"
                onScroll={(e) =>
                  setScrollLabel(
                    formatScrollPosition(
                      e.currentTarget.scrollTop,
                      e.currentTarget.scrollHeight,
                      e.currentTarget.clientHeight
                    )
                  )
                }
              >
                {richContent.node}
              </div>
              <div className="terminal-rich-status">
                {searchOpen ? (
                  <input
                    ref={searchInputRef}
                    className="terminal-rich-search"
                    type="text"
                    value={searchQuery}
                    placeholder="search…"
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      scrollToFirstMatch(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        e.stopPropagation();
                        setSearchOpen(false);
                        setSearchQuery('');
                        focusTerminal();
                      }
                    }}
                  />
                ) : (
                  <span className="terminal-rich-status-left">
                    {richContent.meta.title}
                    {richContent.meta.type && (
                      <span className="terminal-rich-status-type">[{richContent.meta.type}]</span>
                    )}
                  </span>
                )}
                {richContent.meta.type === 'markdown' && (
                  <span className="terminal-rich-status-scroll">{scrollLabel}</span>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}
