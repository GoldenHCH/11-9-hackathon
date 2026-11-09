export const pdfColors = {
  SKY: '#9fd3f0',
  SKY_DEEP: '#6cb6e3',
  CLOUD: '#ffffff',
  GRASS: '#3f8f35',
  GRASS_DARK: '#2f6b2b',
  DIRT: '#8a5a2b',
  DIRT_DARK: '#6b4420',
  STONE: '#9aa1a8',
  PAGE: '#eef3e8',
  CARD: '#ffffff',
  INK: '#1d2420',
  MUTED: '#5b6660',
  SHADOW: '#1d2420',
  GOLD: '#f5d142',
  GOLD_DARK: '#c9a52a',
  CHIP: '#e3efd9',
  LINK: '#1f5fa8',
  XP_TRACK: '#d9e2d3',
} as const;

export const pdfLayout = {
  PAGE_WIDTH: 612,
  PAGE_HEIGHT: 792,
  MARGIN: 44,
  HEADER_HEIGHT: 70,
  FOOTER_HEIGHT: 34,
  CARD_PADDING: 14,
  CARD_GAP: 16,
  SHADOW_OFFSET: 5,
  BORDER: 2,
  BODY_SIZE: 10.5,
  SMALL_SIZE: 9,
  LINE_GAP: 3.5,
  FACE_CELLS: 8,
} as const;

export const pdfFonts = {
  PIXEL_REGULAR: 'Silkscreen-Regular.ttf',
  PIXEL_BOLD: 'Silkscreen-Bold.ttf',
} as const;

export const pdfText = {
  CONFERENCE: 'KubeCon + CloudNativeCon North America 2026',
  CITY: 'Salt Lake City',
  TIME_ZONE: 'America/Denver',
} as const;

export const networkColors = {
  linkedin: '#0a66c2',
  github: '#24292f',
  x: '#000000',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  website: '#2f6b2b',
} as const;

export const networkGlyphs = {
  linkedin: 'IN',
  github: 'GH',
  x: 'X',
  bluesky: 'BS',
  mastodon: 'MA',
  website: 'WW',
} as const;
