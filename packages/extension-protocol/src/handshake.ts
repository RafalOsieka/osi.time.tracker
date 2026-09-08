import { trackerSystemTypeSchema } from '@osi/remote-trackers/contracts';
import { z } from 'zod';
import { operationNameSchema } from './operations.js';
import { EXTENSION_CHANNEL, EXTENSION_PROTOCOL_VERSION } from './version.js';

export const destinationSelectorSchema = z.object({
  provider: trackerSystemTypeSchema,
  baseUrl: z.url(),
});

export type DestinationSelector = z.infer<typeof destinationSelectorSchema>;

export const connectMessageSchema = z.object({
  channel: z.literal(EXTENSION_CHANNEL),
  type: z.literal('connect'),
  protocolVersion: z.literal(EXTENSION_PROTOCOL_VERSION),
});

export type ConnectMessage = z.infer<typeof connectMessageSchema>;

export const handshakeRequestSchema = z.object({
  type: z.literal('handshake'),
  protocolVersion: z.literal(EXTENSION_PROTOCOL_VERSION),
  destination: destinationSelectorSchema.optional(),
});

export type HandshakeRequest = z.infer<typeof handshakeRequestSchema>;

export const handshakeResultSchema = z.object({
  type: z.literal('handshake-result'),
  protocolVersion: z.literal(EXTENSION_PROTOCOL_VERSION),
  supportedOperations: z.array(operationNameSchema).nonempty(),
  destinationApproved: z.boolean().optional(),
});

export type HandshakeResult = z.infer<typeof handshakeResultSchema>;
