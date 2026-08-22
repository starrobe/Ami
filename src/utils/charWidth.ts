/** Returns the terminal display width of a character (1 for ASCII, 2 for CJK/full-width). */
export function charWidth(char: string): number {
  const code = char.codePointAt(0)!;
  // CJK, full-width forms, emoji, etc.
  if (
    (code >= 0x1100 && code <= 0x115F) ||   // Hangul Jamo
    (code >= 0x2E80 && code <= 0x303E) ||   // CJK Radicals, Kangxi
    (code >= 0x3041 && code <= 0x33FF) ||   // Hiragana, Katakana, CJK
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified
    (code >= 0xA000 && code <= 0xA4CF) ||   // Yi
    (code >= 0xAC00 && code <= 0xD7A3) ||   // Hangul Syllables
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK Compatibility Forms
    (code >= 0xFF00 && code <= 0xFF60) ||   // Fullwidth Forms
    (code >= 0xFFE0 && code <= 0xFFE6) ||   // Fullwidth Signs
    (code >= 0x1F300 && code <= 0x1FAFF)    // Emoji
  ) {
    return 2;
  }
  return 1;
}

/** Total display width of a string. */
export function stringWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    width += charWidth(ch);
  }
  return width;
}
