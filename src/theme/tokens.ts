/**
 * Design tokens. Placeholder values until they are synced with the hi-fi
 * Figma file; components only read from here, so swapping values is enough.
 */

export const color = {
  bg: '#FBF8F3',
  surface: '#FFFFFF',
  ink: '#1F2421',
  inkMuted: '#5B635E',
  line: '#E4DED3',
  accent: '#2F6B4F',
  accentInk: '#FFFFFF',
  accentSoft: '#E5EFE9',
  danger: '#B3261E',
} as const;

export const font = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { md: 12, lg: 20 } as const;

/** Caregiver web app: a normal, dense-enough productivity UI. */
export const caregiver = {
  title: 28,
  text: 16,
  small: 14,
  touch: 44,
  maxWidth: 960,
} as const;

/**
 * Parent mode is a separate product: never below 19px type, never below
 * 64px touch targets.
 */
export const parent = {
  title: 34,
  text: 22,
  small: 19,
  touch: 72,
  maxWidth: 560,
} as const;

export type Scale = typeof caregiver | typeof parent;
