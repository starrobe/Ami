/**
 * Format entries into column layout like `ls`.
 * Single row (≤ singleRowLimit): equal spacing with two spaces.
 * Multiple rows: aligned columns, max maxCols columns.
 */
export function formatColumns(
  entries: string[],
  termCols: number,
  singleRowLimit: number = 8,
  maxCols: number = 8
): string {
  if (entries.length === 0) return '';

  if (entries.length <= singleRowLimit) {
    return entries.join('  ');
  }

  const maxLen = Math.max(...entries.map(e => e.length));
  const colWidth = maxLen + 2;
  const numCols = Math.max(1, Math.min(maxCols, Math.floor(termCols / colWidth), entries.length));
  const numRows = Math.ceil(entries.length / numCols);

  const rows: string[] = [];
  for (let row = 0; row < numRows; row++) {
    let line = '';
    for (let col = 0; col < numCols; col++) {
      const idx = row * numCols + col;
      if (idx < entries.length) {
        const isLast = col === numCols - 1 || idx + 1 >= entries.length;
        line += isLast ? entries[idx] : entries[idx].padEnd(colWidth);
      }
    }
    rows.push(line);
  }
  return rows.join('\r\n');
}
