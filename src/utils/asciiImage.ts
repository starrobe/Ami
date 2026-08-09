const CHARS = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^\`\'. ';

export function imageToAscii(image: HTMLImageElement, maxWidth: number = 60): string {
  const aspect = image.naturalHeight / image.naturalWidth;
  const cols = Math.min(maxWidth, image.naturalWidth);
  const rows = Math.floor(cols * aspect * 0.5);

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(image, 0, 0, cols, rows);
  const imageData = ctx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;
  const pixelCount = cols * rows;

  // Pass 1: brightness range
  let minBright = 255, maxBright = 0;
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const brightness = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    if (brightness < minBright) minBright = brightness;
    if (brightness > maxBright) maxBright = brightness;
  }
  const range = maxBright - minBright || 1;

  // Pass 2: render
  let result = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      let normalized = (brightness - minBright) / range;
      normalized = Math.pow(normalized, 0.6);
      const charIndex = Math.floor(normalized * (CHARS.length - 1));
      result += CHARS[Math.max(0, Math.min(charIndex, CHARS.length - 1))];
    }
    result += '\n';
  }

  return result;
}

export function drawAsciiToCanvas(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  maxWidth: number = 100
): void {
  const aspect = image.naturalHeight / image.naturalWidth;
  const cols = Math.min(maxWidth, image.naturalWidth);
  const rows = Math.floor(cols * aspect * 0.5);

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) return;
  sampleCtx.drawImage(image, 0, 0, cols, rows);
  const imageData = sampleCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;
  const pixelCount = cols * rows;

  let minBright = 255, maxBright = 0;
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const brightness = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    if (brightness < minBright) minBright = brightness;
    if (brightness > maxBright) maxBright = brightness;
  }
  const range = maxBright - minBright || 1;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cellH = canvas.height / rows;
  ctx.font = `${cellH}px monospace`;
  const charWidth = ctx.measureText(' ').width;

  canvas.width = Math.ceil(cols * charWidth);
  canvas.height = Math.ceil(rows * cellH);

  ctx.font = `${cellH}px monospace`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      let r = pixels[idx];
      let g = pixels[idx + 1];
      let b = pixels[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      let normalized = (brightness - minBright) / range;
      normalized = Math.pow(normalized, 0.6);
      const charIndex = Math.floor(normalized * (CHARS.length - 1));

      const gray = (r + g + b) / 3;
      const sat = 1.3;
      r = Math.min(255, Math.max(0, gray + (r - gray) * sat));
      g = Math.min(255, Math.max(0, gray + (g - gray) * sat));
      b = Math.min(255, Math.max(0, gray + (b - gray) * sat));

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(CHARS[Math.max(0, Math.min(charIndex, CHARS.length - 1))], x * charWidth, y * cellH);
    }
  }
}
