/** Primitive values vue-i18n interpolates into API error messages. */
export type MessageParamValue = string | number | boolean;

/** Optional interpolation map on `{ messageKey, params }` API errors. */
export type MessageParams = Partial<Record<string, MessageParamValue>>;
