import { i18nPluralRules } from './plural-rules';

export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
  pluralRules: i18nPluralRules,
}));
