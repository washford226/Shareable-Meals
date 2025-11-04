import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions for scaling (iPhone 12/13/14 standard size)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// More granular screen size categories
export const SCREEN_SIZES = {
  EXTRA_SMALL: 320, // iPhone 5/5S (rare but possible)
  SMALL: 375,       // iPhone SE/6/7/8
  MEDIUM: 390,      // iPhone 12/13/14
  LARGE: 414,       // iPhone 11/XR
  EXTRA_LARGE: 430, // iPhone 14 Pro Max
  TABLET: 768,      // iPad
};

// Device type detection
export const isExtraSmallScreen = SCREEN_WIDTH <= SCREEN_SIZES.EXTRA_SMALL;
export const isSmallScreen = SCREEN_WIDTH > SCREEN_SIZES.EXTRA_SMALL && SCREEN_WIDTH <= SCREEN_SIZES.SMALL;
export const isMediumScreen = SCREEN_WIDTH > SCREEN_SIZES.SMALL && SCREEN_WIDTH <= SCREEN_SIZES.MEDIUM;
export const isLargeScreen = SCREEN_WIDTH > SCREEN_SIZES.MEDIUM && SCREEN_WIDTH <= SCREEN_SIZES.LARGE;
export const isExtraLargeScreen = SCREEN_WIDTH > SCREEN_SIZES.LARGE && SCREEN_WIDTH <= SCREEN_SIZES.EXTRA_LARGE;
export const isTablet = SCREEN_WIDTH > SCREEN_SIZES.TABLET;

// Height categories for better vertical space management
export const isShortScreen = SCREEN_HEIGHT <= 667; // iPhone SE/8
export const isMediumHeightScreen = SCREEN_HEIGHT > 667 && SCREEN_HEIGHT <= 812; // iPhone X/11/12
export const isTallScreen = SCREEN_HEIGHT > 812; // iPhone 12 Pro Max and newer

// Device category helper
export const getDeviceCategory = (): 'extraSmall' | 'small' | 'medium' | 'large' | 'extraLarge' | 'tablet' => {
  if (isTablet) return 'tablet';
  if (isExtraLargeScreen) return 'extraLarge';
  if (isLargeScreen) return 'large';
  if (isMediumScreen) return 'medium';
  if (isSmallScreen) return 'small';
  return 'extraSmall';
};

/**
 * Scale font size based on screen width with better granularity
 */
export const scaleFont = (size: number): number => {
  const deviceCategory = getDeviceCategory();
  
  switch (deviceCategory) {
    case 'extraSmall':
      return size * 0.85; // 15% smaller
    case 'small':
      return size * 0.90; // 10% smaller
    case 'medium':
      return size; // Base size
    case 'large':
      return size * 1.05; // 5% larger
    case 'extraLarge':
      return size * 1.10; // 10% larger
    case 'tablet':
      return size * 1.20; // 20% larger
    default:
      return size;
  }
};

/**
 * Scale dimension based on screen width
 */
export const scaleWidth = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Scale dimension based on screen height
 */
export const scaleHeight = (size: number): number => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Get responsive padding based on screen size
 */
export const getResponsivePadding = () => {
  if (SCREEN_WIDTH < 350) {
    return 12; // Small phones
  } else if (SCREEN_WIDTH < 380) {
    return 14; // Medium phones
  } else {
    return 16; // Large phones
  }
};

/**
 * Get responsive margin based on screen size
 */
export const getResponsiveMargin = () => {
  if (SCREEN_WIDTH < 350) {
    return 8; // Small phones
  } else if (SCREEN_WIDTH < 380) {
    return 10; // Medium phones
  } else {
    return 12; // Large phones
  }
};

/**
 * Check if device is a small screen
 */
export const isSmallScreenDevice = (): boolean => {
  return SCREEN_WIDTH <= SCREEN_SIZES.SMALL || SCREEN_HEIGHT < 600;
};

/**
 * Check if device is a short screen (affects calendar layout)
 */
export const isShortScreenDevice = (): boolean => {
  return SCREEN_HEIGHT <= 667;
};

/**
 * Get device size category
 */
export const getDeviceSize = (): 'small' | 'medium' | 'large' => {
  if (SCREEN_WIDTH < 350) return 'small';
  if (SCREEN_WIDTH < 390) return 'medium';
  return 'large';
};

/**
 * Responsive font sizes based on text hierarchy
 */
export const responsiveFontSizes = {
  // Headers
  h1: scaleFont(28),
  h2: scaleFont(24),
  h3: scaleFont(20),
  h4: scaleFont(18),
  h5: scaleFont(16),
  h6: scaleFont(14),
  
  // Body text
  body: scaleFont(16),
  bodyMedium: scaleFont(14),
  bodySmall: scaleFont(12),
  
  // UI elements
  button: scaleFont(16),
  buttonSmall: scaleFont(14),
  caption: scaleFont(10),
  label: scaleFont(12),
  
  // Nutrition values - a bit smaller for more compact calendar
  nutritionValue: scaleFont(10), // Reduced from 11 for tighter fit
  nutritionLabel: scaleFont(7),  // Reduced from 8 for tighter fit
};

/**
 * Legacy font size mapper - helps convert hardcoded font sizes to theme equivalents
 * This is useful for gradually migrating components to use the theme system
 */
export const mapLegacyFontSize = (legacySize: number): keyof typeof responsiveFontSizes | 'custom' => {
  // Map common hardcoded font sizes to appropriate responsive font types
  const fontSizeMap: { [key: number]: keyof typeof responsiveFontSizes } = {
    10: 'caption',
    11: 'caption',
    12: 'bodySmall',
    13: 'label',
    14: 'bodyMedium',
    15: 'bodyMedium',
    16: 'body',
    17: 'body',
    18: 'h4',
    19: 'h4',
    20: 'h3',
    21: 'h3',
    22: 'h3',
    24: 'h2',
    26: 'h2',
    28: 'h1',
    30: 'h1',
  };

  // Return the closest match or 'custom' for sizes that need special handling
  return fontSizeMap[legacySize] || 'custom';
};

/**
 * Get responsive font size for any value - useful for migrating legacy components
 */
export const getResponsiveFontSize = (baseSize: number): number => {
  return scaleFont(baseSize);
};

/**
 * Theme-compatible font family mapper
 */
export const getFontFamily = (fontType: 'system' | 'spacemono' = 'system'): string => {
  return fontType === 'spacemono' ? 'SpaceMono-Regular' : 'System';
};

// Calendar-specific responsive sizing with better proportional scaling
export const getCalendarDayHeight = (): number => {
  // Calculate available height accounting for header and bottom nav
  const availableHeight = SCREEN_HEIGHT - getBottomNavHeight() - 140; // Dynamic bottom nav height
  const deviceCategory = getDeviceCategory();
  
  // Use conservative percentages to ensure content fits without cutoff
  switch (deviceCategory) {
    case 'extraSmall': // iPhone 5/5S (very rare)
      return availableHeight * 0.85; // Reduced to prevent cutoff
    case 'small': // iPhone SE
      return availableHeight * 0.83; // Reduced to prevent cutoff
    case 'medium': // iPhone 12/13/14
      return availableHeight * 0.87; // Reduced to prevent cutoff
    case 'large': // iPhone 11/XR
      return availableHeight * 0.85; // Reduced to prevent cutoff
    case 'extraLarge': // iPhone Pro Max
      return availableHeight * 0.83; // Reduced to prevent cutoff
    case 'tablet':
      return availableHeight * 0.80; // Reduced to prevent cutoff
    default:
      return availableHeight * 0.85; // Reduced to prevent cutoff
  }
};

export const getCalendarDateContainerHeight = (): number => {
  const dayHeight = getCalendarDayHeight();
  
  // Fixed 20% of day container height for all devices
  return dayHeight * 0.20;
};

export const getCalendarNutritionHeight = (): number => {
  const dayHeight = getCalendarDayHeight();
  
  // Fixed 25% of day container height for all devices
  return dayHeight * 0.25;
};

export const getCalendarMealAreaHeight = (): number => {
  const dayHeight = getCalendarDayHeight();
  const dateHeight = getCalendarDateContainerHeight();
  const nutritionHeight = getCalendarNutritionHeight();
  // Now meals get the remaining space (75-80% of the day container)
  return dayHeight - dateHeight - nutritionHeight - 16; // 16px for padding and spacing
};

// Bottom navigation responsive sizing with granular control
export const getBottomNavHeight = (): number => {
  const deviceCategory = getDeviceCategory();
  
  switch (deviceCategory) {
    case 'extraSmall':
      return 60; // Reduced back down for tiny screens
    case 'small': // iPhone SE
      return 65; // Reduced back to prevent white bar issue
    case 'medium':
      return 75; // Keep increased
    case 'large':
      return 80; // Keep increased
    case 'extraLarge':
      return 85; // Keep increased
    case 'tablet':
      return 95; // Keep increased
    default:
      return 75;
  }
};

export const getBottomNavIconSize = (): number => {
  const deviceCategory = getDeviceCategory();
  
  switch (deviceCategory) {
    case 'extraSmall':
      return 20;
    case 'small': // iPhone SE
      return 22;
    case 'medium':
      return 24;
    case 'large':
      return 26;
    case 'extraLarge':
      return 28;
    case 'tablet':
      return 32;
    default:
      return 24;
  }
};

export const getBottomNavFontSize = (): number => {
  const deviceCategory = getDeviceCategory();
  
  switch (deviceCategory) {
    case 'extraSmall':
      return 10;
    case 'small': // iPhone SE
      return 11;
    case 'medium':
      return 12;
    case 'large':
      return 13;
    case 'extraLarge':
      return 14;
    case 'tablet':
      return 16;
    default:
      return 12;
  }
};

export default {
  scaleFont,
  scaleWidth,
  scaleHeight,
  getResponsivePadding,
  getResponsiveMargin,
  isSmallScreen,
  getDeviceSize,
  responsiveFontSizes,
};
