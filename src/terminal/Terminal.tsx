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
      <div className="terminal-titlebar">
        <div className="titlebar-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="titlebar-text">Ami — Terminal</span>
        <div className="titlebar-spacer" />
      </div>
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
