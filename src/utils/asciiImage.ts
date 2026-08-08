const CHARS = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^\`\'. ';

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

  ctx.font = `${ch}px monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const charIndex = Math.floor((brightness / 255) * (CHARS.length - 1));
      const char = CHARS[Math.max(0, Math.min(charIndex, CHARS.length - 1))];

      // Fill cell with pixel color
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * cw, y * ch, cw, ch);

      // Draw character fully opaque for strong texture
      ctx.fillStyle = brightness > 128 ? '#000' : '#fff';
      ctx.fillText(char, x * cw, y * ch);
    }
  }
}
