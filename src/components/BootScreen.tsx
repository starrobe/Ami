import { useEffect, useState } from 'react';

const BOOT_LINES = [
  '[ OK ] Initializing filesystem...',
  '[ OK ] Loading commands...',
  '[ OK ] Starting terminal...',
];

interface Props {
  onComplete: () => void;
}

export default function BootScreen({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Reveal lines one by one
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), 250 * (i + 1)));
    });

    // Start fade after all lines shown
    timers.push(setTimeout(() => setFading(true), 250 * BOOT_LINES.length + 400));
    // Unmount after fade
    timers.push(setTimeout(onComplete, 250 * BOOT_LINES.length + 700));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className={`boot-screen${fading ? ' boot-fading' : ''}`}>
      {BOOT_LINES.slice(0, visibleLines).map(line => (
        <div className="boot-line" key={line}>{line}</div>
      ))}
      <span className="boot-cursor" />
    </div>
  );
}
