import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions for scaling (iPhone 12/13/14 standard size)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Scale font size based on screen width
 * Ensures text remains readable on all screen sizes
 */
export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  
  // Ensure minimum readable size and maximum size limits
  const minSize = size * 0.85; // Never go below 85% of original
  const maxSize = size * 1.15; // Never go above 115% of original
  
  return Math.max(minSize, Math.min(maxSize, newSize));
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
export const isSmallScreen = (): boolean => {
  return SCREEN_WIDTH < 350 || SCREEN_HEIGHT < 600;
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
  
  // Nutrition values
  nutritionValue: scaleFont(14),
  nutritionLabel: scaleFont(10),
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
