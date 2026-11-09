import { z } from 'zod';
import { gameRules } from '../types/kubequest.constants';

export const idSchema = z.string().trim().min(1).max(128);

export const attendeeIdSchema = idSchema;

export const isoDateSchema = z.iso.datetime({ offset: true });

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const topicsSchema = z.array(z.string().trim().min(1).max(60)).max(gameRules.MAX_TOPICS);

export function limitSchema(max: number): z.ZodNumber {
  return z.number().int().min(1).max(max);
}

export const attendeeInputSchema = z.object({ attendeeId: attendeeIdSchema });

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const nameSchema = z.string().trim().min(1).max(80);
