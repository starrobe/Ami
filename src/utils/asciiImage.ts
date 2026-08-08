const CHARS = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^\`\'. ';

export function drawAsciiToCanvas(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  maxWidth: number = 100
): void {
  const aspect = image.naturalHeight / image.naturalWidth;
  const cols = Math.min(maxWidth, image.naturalWidth);
  const rows = Math.floor(cols * aspect * 0.5);

  // Scale to sample resolution
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) return;
  sampleCtx.drawImage(image, 0, 0, cols, rows);
  const imageData = sampleCtx.getImageData(0, 0, cols, rows);
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

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Use font height to derive character width (monospace char width ≈ 0.6 × font height)
  const cellH = canvas.height / rows;
  ctx.font = `${cellH}px monospace`;
  const charWidth = ctx.measureText(' ').width;

  // Resize canvas to match actual character grid dimensions
  canvas.width = Math.ceil(cols * charWidth);
  canvas.height = Math.ceil(rows * cellH);

  ctx.font = `${cellH}px monospace`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // Pass 2: draw characters
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalized = (brightness - minBright) / range;
      const charIndex = Math.floor(normalized * (CHARS.length - 1));

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(CHARS[Math.max(0, Math.min(charIndex, CHARS.length - 1))], x * charWidth, y * cellH);
    }
  }
}
