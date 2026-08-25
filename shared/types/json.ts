/** JSON primitives used on the remote HTTP wire. */
export type JsonPrimitive = string | number | boolean | null;

/** JSON value (object, array, or primitive). */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/** JSON object (not array/null). */
export type JsonObject = { readonly [key: string]: JsonValue };
