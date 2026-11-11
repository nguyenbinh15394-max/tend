/**
 * Design tokens from the Tend hi-fi (Round 1 + 2): clinical white, a calm teal
 * for trust and action, coral reserved for things that need a person, amber
 * for "soon", green for "done". One typeface: Atkinson Hyperlegible Next (the original has no Vietnamese glyphs).
 */

export const color = {
  // Surfaces
  bg: '#F4F7F6',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F0',
  line: '#E2E7E5',
  border: '#CFD8D5',

  // Text
  ink: '#15201E',
  inkMuted: '#5B6764',
  inkSubtle: '#9AA5A2',

  // Teal · action
  accent: '#1D6F68',
  accentStrong: '#12524C',
  accentSoft: '#E6F2F0',
  accentInk: '#FFFFFF',

  // Coral · needs a person
  coral: '#C4452C',
  coralSoft: '#FBECE8',

  // Amber · soon
  amber: '#A8660B',
  amberStrong: '#6B4206',
  amberSoft: '#FDF3E1',

  // Green · done
  green: '#2F7D4A',
  greenSoft: '#E7F4EC',

  danger: '#C4452C',
} as const;

export const font = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 22, xl: 32, xxl: 48 } as const;

export const radius = { md: 12, lg: 22, xl: 24 } as const;

/** Caregiver web app. */
export const caregiver = {
  title: 28,
  text: 16,
  small: 14,
  touch: 44,
  maxWidth: 960,
} as const;

/**
 * Parent mode is a separate product: never below 19px type, never below
 * 64px touch targets. Big actions are 96px tall with 26px labels.
 */
export const parent = {
  title: 34,
  text: 22,
  small: 19,
  touch: 72,
  action: 96,
  actionLabel: 26,
  maxWidth: 560,
} as const;

export type Scale = typeof caregiver | typeof parent;
