export const linkNetworkOptions = [
  { network: 'linkedin', label: 'LinkedIn', glyph: 'in', placeholder: 'linkedin.com/in/your-name', hint: 'Your public profile URL' },
  { network: 'github', label: 'GitHub', glyph: 'GH', placeholder: 'your-username', hint: 'We read your public repos to improve matches' },
  { network: 'x', label: 'X', glyph: 'X', placeholder: '@you', hint: 'Handle or x.com link' },
  { network: 'bluesky', label: 'Bluesky', glyph: 'BS', placeholder: 'you.bsky.social', hint: 'We read your public bio to improve matches' },
  { network: 'mastodon', label: 'Mastodon', glyph: 'M', placeholder: '@you@hachyderm.io', hint: 'Full address with your server' },
  { network: 'website', label: 'Website', glyph: 'WWW', placeholder: 'https://your-site.dev', hint: 'Must start with https' },
] as const;

export const linkNetworkColors = {
  linkedin: '#0a66c2',
  github: '#24292f',
  x: '#000000',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  website: '#2f6b2b',
} as const;
