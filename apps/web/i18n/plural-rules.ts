/**
 * vue-i18n plural choice indexes for Polish (CLDR one / few / many).
 * 0 = one (n === 1), 1 = few (2–4, 22–24, …), 2 = many (0, 5–21, 25–31, …).
 */
export function polishPluralRule(choice: number, choicesLength: number): number {
  if (choice === 1) return 0;
  const teen = choice % 100 >= 10 && choice % 100 <= 20;
  const endsWithFew = choice % 10 >= 2 && choice % 10 <= 4;
  if (!teen && endsWithFew) return 1;
  return Math.min(2, Math.max(0, choicesLength - 1));
}

export const i18nPluralRules = {
  pl: polishPluralRule,
};
