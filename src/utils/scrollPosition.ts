/**
 * Formats a scroll position into vim's statusline convention:
 * "Top" when at the top or not scrollable, "Bot" when at the bottom,
 * otherwise "NN%".
 */
export function formatScrollPosition(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): string {
  const max = scrollHeight - clientHeight;
  if (max <= 0 || scrollTop <= 0) return 'Top';
  if (scrollTop >= max - 1) return 'Bot';
  return `${Math.round((scrollTop / max) * 100)}%`;
}
