import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isPhone = width < 768;
  const contentMaxWidth = width >= 1400 ? 1180 : width >= 1100 ? 1080 : width >= 768 ? 520 : width;

  return {
    width,
    isCompact,
    isPhone,
    isTablet: width >= 768,
    isDesktop: width >= 1100,
    contentMaxWidth,
    horizontalPadding: isCompact ? 14 : 20,
  };
}
