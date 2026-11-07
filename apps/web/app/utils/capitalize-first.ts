/**
 * Upper-cases the first letter of a label in the given locale. Polish dates and months are
 * lower-case mid-sentence ("sobota", "listopad"), but a heading or a standalone period label
 * starts with a capital.
 */
export function capitalizeFirst(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
