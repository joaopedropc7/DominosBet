import { colors, radius, shadows, spacing, typography } from './tokens';

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  layout: {
    maxContentWidth: 1180,
    maxCardWidth: 520,
    bottomNavHeight: 92,
  },
} as const;

export type AppTheme = typeof theme;
