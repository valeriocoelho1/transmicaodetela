import { z } from 'zod';

export const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{12}$/;

export const healthResponse = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponse>;
