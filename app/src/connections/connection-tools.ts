import { z } from 'zod';
import { getLinks, updateLinks } from '../links/links';
import { listTalkNotes, saveTalkNote } from '../talk-notes/talk-notes';
import { defineTool, IRegisteredTool } from '../tools/define-tool';
import { attendeeIdSchema, attendeeInputSchema, idSchema, isoDateSchema } from '../tools/tool-schemas';
import { connectionRules } from '../types/connections.constants';
import { ConnectionToolName } from '../types/connections.types';
import { listConnections, saveConnectionNote } from './connections';

const linkValueSchema = z.string().trim().max(connectionRules.LINK_MAX_CHARS);

const updateLinksTool = defineTool({
  name: 'update_links',
  description:
    "Save the player's social links (linkedin, github, x, bluesky, mastodon, website). Handles and URLs are normalized and only the matching domains are accepted; an empty string removes a link. Saving GitHub or Bluesky reads their public profile into the player's matching text.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    links: z.object({
      linkedin: linkValueSchema.optional(),
      github: linkValueSchema.optional(),
      x: linkValueSchema.optional(),
      bluesky: linkValueSchema.optional(),
      mastodon: linkValueSchema.optional(),
      website: linkValueSchema.optional(),
    }),
  }),
  run: async (input) => updateLinks(input),
});

const getLinksTool = defineTool({
  name: 'get_links',
  description:
    "A player's social links. Visible only to the player themselves and to players they have met (a met meet or a completed handshake); otherwise visible is false and links are empty.",
  input: z.object({ viewerId: attendeeIdSchema, targetPublicId: idSchema }),
  run: async (input) => getLinks(input),
});

const listConnectionsTool = defineTool({
  name: 'list_connections',
  description:
    'People the player has met (a met meet or a completed handshake): their public card and links, where and when they met, the chat prompt, shared topics and the private notes the player wrote about them.',
  input: attendeeInputSchema,
  run: async (input) => listConnections(input.attendeeId),
});

const saveConnectionNoteTool = defineTool({
  name: 'save_connection_note',
  description: 'Save the private "what we talked about" and "next steps" notes for a connection. Only the author ever sees them.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    connectionId: idSchema,
    talkedAbout: z.string().trim().max(connectionRules.NOTE_MAX_CHARS),
    nextSteps: z.string().trim().max(connectionRules.NOTE_MAX_CHARS),
    followUpBy: isoDateSchema.optional(),
  }),
  run: async (input) => saveConnectionNote(input),
});

const saveTalkNoteTool = defineTool({
  name: 'save_talk_note',
  description: "Save the player's private note and takeaways for a talk. Saving again edits the note. It appears in the recap with the talk and its speakers.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    talkId: idSchema,
    note: z.string().trim().max(connectionRules.NOTE_MAX_CHARS),
    takeaways: z.array(z.string().trim().max(connectionRules.TAKEAWAY_MAX_CHARS)).max(connectionRules.MAX_TAKEAWAYS).optional(),
  }),
  run: async (input) => saveTalkNote(input),
});

const listTalkNotesTool = defineTool({
  name: 'list_talk_notes',
  description: "The player's private talk notes, newest first. Pass talkId for one talk.",
  input: z.object({ attendeeId: attendeeIdSchema, talkId: idSchema.optional() }),
  run: async (input) => listTalkNotes(input),
});

export const connectionToolRegistry = {
  update_links: updateLinksTool,
  get_links: getLinksTool,
  list_connections: listConnectionsTool,
  save_connection_note: saveConnectionNoteTool,
  save_talk_note: saveTalkNoteTool,
  list_talk_notes: listTalkNotesTool,
} satisfies { [TName in ConnectionToolName]: IRegisteredTool<TName> };
