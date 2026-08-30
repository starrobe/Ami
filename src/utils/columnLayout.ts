import { stringWidth } from './charWidth';

/**
 * Format entries into column layout like `ls`.
 * Single row (≤ singleRowLimit): equal spacing with two spaces.
 * Multiple rows: aligned columns, max maxCols columns.
 * highlightIndex ≥ 0 wraps that cell in reverse video (xterm \x1b[7m).
 */

/** Pads a string to the given terminal display width (CJK-aware). */
function padToWidth(str: string, width: number): string {
  const w = stringWidth(str);
  return w >= width ? str : str + ' '.repeat(width - w);
}

export function formatColumns(
  entries: string[],
  termCols: number,
  singleRowLimit: number = 8,
  maxCols: number = 8,
  highlightIndex: number = -1
): string {
  if (entries.length === 0) return '';

  if (entries.length <= singleRowLimit) {
    return entries.map((e, i) => (i === highlightIndex ? '\x1b[7m' + e + '\x1b[0m' : e)).join('  ');
  }

  const maxWidth = Math.max(...entries.map((e) => stringWidth(e)));
  const colWidth = maxWidth + 2;
  const numCols = Math.max(1, Math.min(maxCols, Math.floor(termCols / colWidth), entries.length));
  const numRows = Math.ceil(entries.length / numCols);

  const rows: string[] = [];
  for (let row = 0; row < numRows; row++) {
    let line = '';
    for (let col = 0; col < numCols; col++) {
      const idx = row * numCols + col;
      if (idx < entries.length) {
        const isLast = col === numCols - 1 || idx + 1 >= entries.length;
        const cell = isLast ? entries[idx] : padToWidth(entries[idx], colWidth);
        line += idx === highlightIndex ? '\x1b[7m' + cell + '\x1b[0m' : cell;
      }
    }
    rows.push(line);
  }
  return rows.join('\r\n');
}
