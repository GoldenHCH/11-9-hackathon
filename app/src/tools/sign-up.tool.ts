import { z } from 'zod';
import { defineTool } from './define-tool';
import { signUp } from '../profile/sign-up';
import { intentDescription, intentSchema } from './intent-schema';
import { attendeeIdSchema, idSchema, topicsSchema } from './tool-schemas';

export const signUpTool = defineTool({
  name: 'sign_up',
  description:
    'Create a player from a handle, two questions and the meeting choice. Returns the profile, the personal link, a starter block and the first quest. If the player arrived from a room scan, that check-in is credited too. Pass attendeeId (from sign_in) to finish onboarding for an existing player instead: the same fields update that player, and handle becomes optional. headline, skills, offers, asks and summary come from a confirmed import_profile; they feed matching and stay private. seniority comes from import_profile too. ' + intentDescription,
  input: z
    .object({
      attendeeId: attendeeIdSchema.optional(),
      handle: z.string().trim().toLowerCase().min(3).max(20).regex(/^[a-z0-9_.-]+$/).optional(),
      workingOn: z.string().trim().max(500),
      firstKubeCon: z.boolean(),
      happyToWelcome: z.boolean().optional(),
      topics: topicsSchema.optional(),
      meetingOn: z.boolean(),
      spotMe: z.string().trim().max(140).optional(),
      githubLogin: z.string().trim().max(39).regex(/^[A-Za-z0-9-]+$/).optional(),
      realName: z.string().trim().max(80).optional(),
      accessibleMode: z.boolean().optional(),
      noWalking: z.boolean().optional(),
      scanLocationId: idSchema.optional(),
      scanToken: z.string().max(512).optional(),
      headline: z.string().trim().max(120).optional(),
      skills: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
      offers: z.array(z.string().trim().min(1).max(140)).max(8).optional(),
      asks: z.array(z.string().trim().min(1).max(140)).max(8).optional(),
      summary: z.string().trim().max(1200).optional(),
      seniority: z.string().trim().max(30).optional(),
      intent: intentSchema.optional(),
    })
    .refine((input) => input.attendeeId !== undefined || input.handle !== undefined, { message: 'handle is required to create a player', path: ['handle'] }),
  xpAwarded: (output) => output.xpAwarded,
  run: signUp,
});
