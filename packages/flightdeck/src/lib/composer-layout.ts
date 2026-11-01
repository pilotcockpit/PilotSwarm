/**
 * How tall the message box starts. A phone has the keyboard and little else, so the box opens at one
 * line and grows as you type (the autosize effect in the composer does the growing); a wider screen opens
 * at two. The numbers are rows, not pixels, so they follow the text size.
 */
export const COMPOSER_ROWS_PHONE = 1;
export const COMPOSER_ROWS_WIDE = 2;

export function composerRows(phone: boolean): number {
  return phone ? COMPOSER_ROWS_PHONE : COMPOSER_ROWS_WIDE;
}
