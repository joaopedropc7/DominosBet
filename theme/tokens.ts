export const colors = {
  background: '#131313',
  surface: '#1C1B1B',
  surfaceMuted: '#201F1F',
  surfaceHigh: '#2A2A2A',
  surfaceHighest: '#353534',
  surfaceInset: '#0E0E0E',
  primary: '#F2CA50',
  primaryDeep: '#D4AF37',
  primarySoft: 'rgba(242, 202, 80, 0.12)',
  accent: '#00E4F1',
  accentSoft: 'rgba(0, 228, 241, 0.12)',
  text: '#E5E2E1',
  textMuted: '#D0C5AF',
  textSoft: 'rgba(229, 226, 225, 0.66)',
  textFaint: 'rgba(229, 226, 225, 0.36)',
  outline: '#4D4635',
  whiteSoft: 'rgba(255,255,255,0.08)',
  success: '#F2CA50',
  danger: '#FF8B87',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  fontFamily: {
    display: 'SpaceGrotesk_700Bold',
    displayMedium: 'SpaceGrotesk_500Medium',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },
  size: {
    label: 11,
    body: 14,
    bodyLarge: 16,
    title: 22,
    headline: 30,
    display: 56,
  },
} as const;

export const shadows = {
  ambient: {
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;
