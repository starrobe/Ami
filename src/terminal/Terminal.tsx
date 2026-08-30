import { useEffect, useRef, useState } from 'react';
import { useTerminal } from './useTerminal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatScrollPosition } from '../utils/scrollPosition';
import './Terminal.css';

export default function Terminal() {
  const { containerRef, initTerminal, manager, suspendForeground } = useTerminal();
  const richBodyRef = useRef<HTMLDivElement | null>(null);
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

  // Reset scroll position and label whenever the rich content changes
  useEffect(() => {
    if (richBodyRef.current) richBodyRef.current.scrollTop = 0;
    setScrollLabel('Top');
  }, [richContent]);

  return (
    <div className="terminal-shell">
      <div className="terminal-content">
        <div ref={containerRef} className="terminal-xterm" />
      </div>
      {richContent && (
        <ErrorBoundary>
          <div className="terminal-rich-backdrop" onClick={suspendForeground}>
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
