import { useEffect } from 'react';
import { useTerminal } from './useTerminal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import './Terminal.css';

export default function Terminal() {
  const { containerRef, initTerminal, state, setRichContent } = useTerminal();

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

  return (
    <div className="terminal-shell">
      <div className="terminal-content">
        <div ref={containerRef} className="terminal-xterm" />
      </div>
      {state.richContent && (
        <ErrorBoundary>
          <div className="terminal-rich-backdrop" onClick={() => setRichContent(null)}>
            <div className="terminal-rich" onClick={(e) => e.stopPropagation()}>
              <div className="terminal-rich-body">{state.richContent}</div>
            </div>
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}
