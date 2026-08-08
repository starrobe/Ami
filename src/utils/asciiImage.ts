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

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cellH = canvas.height / rows;
  ctx.font = `${cellH}px monospace`;
  const charWidth = ctx.measureText(' ').width;
  const cw = Math.ceil(charWidth);
  const ch = Math.ceil(cellH);
  canvas.width = cols * cw;
  canvas.height = rows * ch;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      ctx.fillStyle = `rgb(${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]})`;
      ctx.fillRect(x * cw, y * ch, cw, ch);
    }
  }
}
