import { useEffect } from 'react';
import { useTerminal } from './useTerminal';
import './Terminal.css';

export default function Terminal() {
  const { containerRef, initTerminal, state } = useTerminal();

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
  }, []);

  return (
    <div className="terminal-shell">
      <div className="terminal-content">
        <div ref={containerRef} className="terminal-xterm" />
        {state.richContent && (
          <div className="terminal-rich">
            {state.richContent}
          </div>
        )}
      </div>
    </div>
  );
}
