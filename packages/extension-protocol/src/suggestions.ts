import { trackerSystemTypeSchema } from '@osi/remote-trackers/contracts';
import { z } from 'zod';
import { safeWireErrorSchema } from './errors.js';
import { requestIdSchema } from './operations.js';

/**
 * An approved website asks the extension to queue a tracker destination for the user's review
 * (REQ-421). It carries no secret and no website: the extension takes the website from the
 * verified sender. Strict, so a forged `websiteOrigin` or a stray secret fails validation.
 */
export const suggestDestinationRequestSchema = z.strictObject({
  type: z.literal('suggest-destination'),
  requestId: requestIdSchema,
  provider: trackerSystemTypeSchema,
  baseUrl: z.url(),
});

export type SuggestDestinationRequest = z.infer<typeof suggestDestinationRequestSchema>;

/** `queued` awaits review in the extension; `alreadyApproved` needs nothing from the user. */
export const suggestDestinationStatusSchema = z.enum(['queued', 'alreadyApproved']);

export type SuggestDestinationStatus = z.infer<typeof suggestDestinationStatusSchema>;

export const suggestDestinationResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    type: z.literal('suggest-destination-result'),
    requestId: requestIdSchema,
    ok: z.literal(true),
    status: suggestDestinationStatusSchema,
  }),
  z.strictObject({
    type: z.literal('suggest-destination-result'),
    requestId: requestIdSchema,
    ok: z.literal(false),
    error: safeWireErrorSchema,
  }),
]);

export type SuggestDestinationResult = z.infer<typeof suggestDestinationResultSchema>;
