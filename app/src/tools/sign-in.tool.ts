import { z } from 'zod';
import { defineTool } from './define-tool';
import { signIn } from '../profile/sign-in';
import { emailSchema, nameSchema } from './tool-schemas';

export const signInTool = defineTool({
  name: 'sign_in',
  description:
    'Demo sign-in with a name and an email, no password. Finds the player with that email or creates a minimal one. Returns the own profile, the personal link, whether the player is new, and whether onboarding (workingOn, topics, meeting choice) still has to run. The email and name are private: they never appear in another player\'s view.',
  input: z.object({
    name: nameSchema,
    email: emailSchema,
  }),
  run: signIn,
});
