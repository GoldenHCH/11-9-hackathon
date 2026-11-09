export const linkNetworks = ['linkedin', 'github', 'x', 'bluesky', 'mastodon', 'website'] as const;

export const connectionSources = ['meet', 'handshake'] as const;

export const connectionToolNames = ['update_links', 'get_links', 'list_connections', 'save_connection_note', 'save_talk_note', 'list_talk_notes'] as const;

export const docKinds = {
  BOOTH_NOTE: 'booth_note',
  TALK_NOTE: 'talk_note',
  CHAT: 'chat',
  CONNECTION: 'connection',
  CONNECTION_NOTE: 'connection_note',
} as const;

export const connectionRules = {
  NOTE_MAX_CHARS: 2000,
  TAKEAWAY_MAX_CHARS: 280,
  MAX_TAKEAWAYS: 10,
  LINK_MAX_CHARS: 300,
  ENRICH_TIMEOUT_MS: 4000,
  TOP_LANGUAGES: 4,
  REPOS_FOR_LANGUAGES: 30,
  PROFILE_SUMMARY_MAX_CHARS: 400,
} as const;
