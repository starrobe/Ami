import { useEffect, useRef, useState } from 'react';
import { drawAsciiToCanvas } from '../utils/asciiImage';

interface Props {
  url: string;
  maxWidth?: number;
}

export default function AsciiAvatar({ url, maxWidth = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    if (url.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const cols = Math.min(maxWidth, img.naturalWidth);
        const rows = Math.floor(cols * (img.naturalHeight / img.naturalWidth) * 0.5);
        const CELL = 8;
        canvas.width = cols * CELL;
        canvas.height = rows * CELL;

        drawAsciiToCanvas(img, canvas, maxWidth);
        setState('done');
      } catch {
        setState('error');
      }
    };
    img.onerror = () => { if (!cancelled) setState('error'); };
    img.src = url;
    return () => { cancelled = true; };
  }, [url, maxWidth]);

  if (state === 'error') return null;

  return (
    <div>
      {state === 'loading' && <div className="ascii-loading">Loading...</div>}
      <canvas
        ref={canvasRef}
        className="ascii-canvas"
        style={{
          display: state === 'done' ? 'block' : 'none',
          width: '100%',
          maxWidth: '350px',
          height: 'auto',
        }}
      />
    </div>
  );
}
