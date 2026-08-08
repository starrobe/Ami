const CHARS = '@%#*+=-:. ';

export function imageToAscii(image: HTMLImageElement, maxWidth: number = 60): string {
  const aspect = image.naturalHeight / image.naturalWidth;
  const width = Math.min(maxWidth, image.naturalWidth);
  // Terminal characters are ~2x taller than wide, so halve the height
  const height = Math.floor(width * aspect * 0.5);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  let result = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      // Perceived brightness
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const charIndex = Math.floor((brightness / 255) * (CHARS.length - 1));
      result += CHARS[charIndex];
    }
    result += '\n';
  }

  return result;
}
