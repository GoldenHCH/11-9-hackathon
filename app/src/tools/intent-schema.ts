import { z } from 'zod';
import { attendeeGoals, socialLevels } from '../types/intent.constants';

export const intentSchema = z.object({
  goals: z.array(z.enum(attendeeGoals)).max(attendeeGoals.length),
  exploringField: z.string().trim().max(60).optional(),
  socialLevel: z.enum(socialLevels).optional(),
});

export const intentDescription =
  'intent is why the player is here today: goals (exploring, deep_dive, hiring, job_seeking, booth, community, talks, sent), exploringField (the field they are exploring, with goal exploring) and socialLevel (light, some or lots; defaults from the goals). It shapes the quest mix and people matching, and stays private.';
