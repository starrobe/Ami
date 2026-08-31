import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminal } from './useTerminal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatScrollPosition } from '../utils/scrollPosition';
import './Terminal.css';

const LINE_SCROLL = 40;

export default function Terminal() {
  const { containerRef, initTerminal, manager, suspendForeground, interruptForeground } = useTerminal();
  const richBodyRef = useRef<HTMLDivElement | null>(null);
  const pendingGRef = useRef(false);
  const [scrollLabel, setScrollLabel] = useState('Top');

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

  // Reset scroll state whenever the rich content changes
  useEffect(() => {
    if (richBodyRef.current) richBodyRef.current.scrollTop = 0;
    setScrollLabel('Top');
    pendingGRef.current = false;
  }, [richContent]);

  const scrollToTop = useCallback(() => {
    if (richBodyRef.current) richBodyRef.current.scrollTop = 0;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = richBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const scrollBy = useCallback((delta: number) => {
    const el = richBodyRef.current;
    if (el) el.scrollTop += delta;
  }, []);

  const terminatePanel = useCallback(() => {
    const fg = manager.getForeground();
    if (fg) manager.signal(fg.pid, 'SIGTERM');
  }, [manager]);

  // Intercept pager keys while the panel is open (terminal keeps focus for commands)
  useEffect(() => {
    if (!richContent) return;

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
      if (e.key === 'G') {
        e.preventDefault();
        e.stopPropagation();
        pendingGRef.current = false;
        scrollToBottom();
        return;
      }
      if (e.key === 'j') {
        e.preventDefault();
        e.stopPropagation();
        pendingGRef.current = false;
        scrollBy(LINE_SCROLL);
        return;
      }
      if (e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        pendingGRef.current = false;
        scrollBy(-LINE_SCROLL);
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
  }, [richContent, scrollToBottom, scrollToTop, scrollBy, terminatePanel, suspendForeground, interruptForeground]);

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
                <span className="terminal-rich-status-left">
                  {richContent.meta.title}
                  {richContent.meta.type && (
                    <span className="terminal-rich-status-type">[{richContent.meta.type}]</span>
                  )}
                </span>
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
