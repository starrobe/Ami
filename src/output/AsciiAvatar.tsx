import { useEffect, useState } from 'react';
import { imageToAscii } from '../utils/asciiImage';

interface Props {
  url: string;
  maxWidth?: number;
}

export default function AsciiAvatar({ url, maxWidth = 40 }: Props) {
  const [ascii, setAscii] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const result = imageToAscii(img, maxWidth);
        setAscii(result);
      } catch {
        setError(true);
      }
    };
    img.onerror = () => setError(true);
    img.src = url;
  }, [url, maxWidth]);

  if (error) return null;
  if (!ascii) return <div className="ascii-loading">Loading...</div>;

  return <pre className="ascii-avatar">{ascii}</pre>;
}
