/**
 * Style Helper Functions
 * Utility functions for creating dynamic styles with theme colors
 * Based on ChoresQuest's dynamic style creation system
 */

import { StyleSheet } from 'react-native';

/**
 * Interface for common theme colors used in dynamic styles
 */
export interface ThemeStyleColors {
  // Core colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundCard: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // UI colors
  border: string;
  borderLight: string;
  success: string;
  warning: string;
  danger: string;
  error: string;
  info: string;
  
  // Button colors
  button: string;
  buttonSecondary: string;
  buttonText: string;
  buttonTextPrimary: string;
  
  // Additional UI
  shadow: string;
  shadowDark: string;
  placeholder: string;
  
  // Tab colors
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
}

/**
 * Creates dynamic styles using theme colors
 * Similar to ChoresQuest's createStyles pattern
 */
export const createDynamicStyles = (colors: ThemeStyleColors) => {
  return StyleSheet.create({
    // Container styles
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    
    scrollView: {
      flex: 1,
    },
    
    // Card styles
    card: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    
    cardSecondary: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    
    // Text styles
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    
    subtitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    
    body: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 22,
    },
    
    caption: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    
    footnote: {
      fontSize: 12,
      color: colors.textMuted,
    },
    
    // Button styles
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    
    primaryButtonText: {
      color: colors.buttonTextPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    
    secondaryButton: {
      backgroundColor: colors.buttonSecondary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    
    secondaryButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
    
    // Input styles
    input: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    
    inputFocused: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 0,
      },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    
    // Status styles
    successBadge: {
      backgroundColor: colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    
    successText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    
    warningBadge: {
      backgroundColor: colors.warning,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    
    warningText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    
    dangerBadge: {
      backgroundColor: colors.danger,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    
    dangerText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    
    // Header styles
    header: {
      paddingVertical: 20,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundCard,
    },
    
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    
    // Navigation styles
    tabBar: {
      backgroundColor: colors.backgroundCard,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    
    // Loading and empty states
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    
    emptyStateSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    
    // Separator styles
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    
    // Icon styles
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    modalContent: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      padding: 20,
      margin: 20,
      maxHeight: '80%',
      shadowColor: colors.shadowDark,
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
  });
};

/**
 * Creates meal-specific dynamic styles
 */
export const createMealStyles = (colors: ThemeStyleColors & { 
  mealColors: { [key: string]: string },
  mealAccent: { [key: string]: string }
}) => {
  return StyleSheet.create({
    mealCard: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    
    mealImage: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    
    mealName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    
    mealDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      lineHeight: 18,
    },
    
    macroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    
    macroItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
      marginBottom: 4,
    },
    
    macroText: {
      fontSize: 12,
      marginLeft: 4,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    
    // Meal type badges
    mealTypeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    
    mealTypeText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'white',
    },
  });
};

/**
 * Helper function to get meal type specific colors
 */
export const getMealTypeColor = (mealType: string, colors: any) => {
  const mealTypeColors = colors.mealAccent || {};
  return mealTypeColors[mealType.toLowerCase()] || colors.primary;
};

/**
 * Helper function to create responsive spacing based on screen size
 */
export const createResponsiveSpacing = (baseSpacing: number = 16) => {
  return {
    xs: baseSpacing * 0.5,
    sm: baseSpacing * 0.75,
    md: baseSpacing,
    lg: baseSpacing * 1.5,
    xl: baseSpacing * 2,
    xxl: baseSpacing * 3,
  };
};

/**
 * Helper function to create shadow styles based on elevation
 */
export const createShadowStyle = (elevation: number, shadowColor: string = '#000') => {
  if (elevation === 0) {
    return {};
  }
  
  return {
    shadowColor,
    shadowOffset: {
      width: 0,
      height: Math.ceil(elevation / 2),
    },
    shadowOpacity: 0.1 + (elevation * 0.02),
    shadowRadius: elevation,
    elevation,
  };
};

/**
 * Helper function to add transparency to hex colors
 */
export const addTransparency = (hexColor: string, opacity: number): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert opacity to hex (0-1 to 00-FF)
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  
  return `#${hex}${alpha}`;
};