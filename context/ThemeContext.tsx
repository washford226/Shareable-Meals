import React, { createContext, useState, useEffect, useContext } from 'react';
import { Appearance, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get screen dimensions for responsive font sizing
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export type ThemeVariant = 'light' | 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'dark';
export type FontFamily = 'system' | 'spacemono' | 'dancingscript' | 'medievalsharp' | 'opensans' | 'roboto';
export type FontSize = 'small' | 'regular' | 'large';

// Responsive font scaling function based on screen width
const getResponsiveFontSize = (baseSize: number): number => {
  // Define breakpoints for different screen sizes
  if (screenWidth < 350) {
    // Very small phones (iPhone SE 1st gen, etc.)
    return Math.round(baseSize * 0.85);
  } else if (screenWidth < 375) {
    // Small phones (iPhone SE 2nd/3rd gen, etc.)
    return Math.round(baseSize * 0.9);
  } else if (screenWidth < 414) {
    // Standard phones (iPhone 12/13/14, etc.)
    return baseSize;
  } else if (screenWidth < 500) {
    // Large phones (iPhone Plus/Pro Max, etc.)
    return Math.round(baseSize * 1.05);
  } else if (screenWidth < 768) {
    // Small tablets
    return Math.round(baseSize * 1.1);
  } else {
    // Large tablets and desktop
    return Math.round(baseSize * 1.15);
  }
};

// Font size configurations based on screen size and user preference
const baseFontSizes = {
  small: {
    tiny: getResponsiveFontSize(10),
    caption: getResponsiveFontSize(11),
    footnote: getResponsiveFontSize(12),
    subheadline: getResponsiveFontSize(13),
    callout: getResponsiveFontSize(14),
    body: getResponsiveFontSize(15),
    headline: getResponsiveFontSize(16),
    title3: getResponsiveFontSize(18),
    title2: getResponsiveFontSize(20),
    title1: getResponsiveFontSize(26),
    largeTitle: getResponsiveFontSize(32),
  },
  regular: {
    tiny: getResponsiveFontSize(11),
    caption: getResponsiveFontSize(12),
    footnote: getResponsiveFontSize(13),
    subheadline: getResponsiveFontSize(14),
    callout: getResponsiveFontSize(15),
    body: getResponsiveFontSize(16),
    headline: getResponsiveFontSize(17),
    title3: getResponsiveFontSize(19),
    title2: getResponsiveFontSize(21),
    title1: getResponsiveFontSize(27),
    largeTitle: getResponsiveFontSize(33),
  },
  large: {
    tiny: getResponsiveFontSize(12),
    caption: getResponsiveFontSize(13),
    footnote: getResponsiveFontSize(14),
    subheadline: getResponsiveFontSize(15),
    callout: getResponsiveFontSize(16),
    body: getResponsiveFontSize(17),
    headline: getResponsiveFontSize(18),
    title3: getResponsiveFontSize(20),
    title2: getResponsiveFontSize(22),
    title1: getResponsiveFontSize(28),
    largeTitle: getResponsiveFontSize(34),
  },
};

// Font family configurations - System (default) and premium fonts
const fontFamilies = {
  system: 'System',
  spacemono: 'SpaceMono-Regular',
  dancingscript: 'DancingScript-Regular',
  medievalsharp: 'MedievalSharp-Regular',
  opensans: 'OpenSans-Regular',
  roboto: 'Roboto-Regular',
};

// Theme categories for organization
export const themeCategories = {
  light: ['light', 'blue', 'green'], // Light themes with dark text
  dark: ['purple', 'orange', 'pink', 'dark'], // Dark themes with light text
};

// Enhanced theme colors based on ChoresQuest comprehensive system
const themeColors = {
  // LIGHT CATEGORY THEMES (light backgrounds, dark text)
  light: {
    // Text colors
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    textMuted: '#BDC3C7',
    
    // Background colors
    background: '#FFFFFF',
    backgroundSecondary: '#F8F9FA',
    backgroundCard: '#FFFFFF',
    
    // Primary colors
    primary: '#4A90E2',
    primaryDark: '#357ABD',
    primaryLight: '#93c5fd',
    
    // Secondary and accent
    secondary: '#ADB5BD',
    accent: '#20C997',
    
    // Status colors
    success: '#28A745',
    warning: '#FFC107',
    danger: '#DC3545',
    error: '#DC3545',
    info: '#17A2B8',
    
    // Border and separator colors
    border: '#E1E5E9',
    borderLight: '#F1F3F4',
    borderDark: '#cbd5e1',
    divider: '#f1f5f9',
    
    // Button colors
    button: '#ffffff',
    buttonSecondary: '#f1f5f9',
    buttonText: '#2C3E50',
    buttonTextPrimary: '#ffffff',
    
    // Additional UI colors
    placeholder: '#BDC3C7',
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowDark: 'rgba(0, 0, 0, 0.15)',
    
    // Tab colors
    tint: '#4A90E2',
    icon: '#6C757D',
    tabIconDefault: '#ADB5BD',
    tabIconSelected: '#4A90E2',
    
    // Meal/Food specific colors
    starColor: '#FFD700',
    mealColors: {
      breakfast: '#FFF8DC',
      lunch: '#F0FFF0',
      dinner: '#F0F8FF',
      snack: '#FFF5EE',
      dessert: '#FDF5E6',
    },
    mealAccent: {
      breakfast: '#FFD700',
      lunch: '#28A745',
      dinner: '#4A90E2',
      snack: '#FF8C00',
      dessert: '#FF69B4',
    },
    
    // Nutrition macro colors
    protein: '#DC3545',
    carbs: '#17A2B8',
    fat: '#FFC107',
    fiber: '#28A745',
    
    // Special feature colors
    aiAccent: '#8E44AD',
    premium: '#FFD700',
    link: '#4A90E2',
    linkHover: '#357ABD',
  },
  
  blue: {
    // Text colors
    text: '#1E3A5F',
    textSecondary: '#2F4F4F',
    textMuted: '#708090',
    
    // Background colors
    background: '#F0F8FF',
    backgroundSecondary: '#E6F3FF',
    backgroundCard: '#FFFFFF',
    
    // Primary colors
    primary: '#4682B4',
    primaryDark: '#2F4F4F',
    primaryLight: '#87CEEB',
    
    // Secondary and accent
    secondary: '#5F9EA0',
    accent: '#87CEEB',
    
    // Status colors
    success: '#20B2AA',
    warning: '#FF8C00',
    danger: '#DC143C',
    error: '#DC143C',
    info: '#1E90FF',
    
    // Border and separator colors
    border: '#B0C4DE',
    borderLight: '#E0F6FF',
    borderDark: '#87CEEB',
    divider: '#E0F6FF',
    
    // Button colors
    button: '#F0F8FF',
    buttonSecondary: '#E6F3FF',
    buttonText: '#1E3A5F',
    buttonTextPrimary: '#ffffff',
    
    // Additional UI colors
    placeholder: '#708090',
    shadow: 'rgba(30, 58, 95, 0.1)',
    shadowDark: 'rgba(30, 58, 95, 0.15)',
    
    // Tab colors
    tint: '#4682B4',
    icon: '#2F4F4F',
    tabIconDefault: '#708090',
    tabIconSelected: '#4682B4',
    
    // Meal/Food specific colors
    starColor: '#DAA520',
    mealColors: {
      breakfast: '#F0F8FF',
      lunch: '#E0F6FF',
      dinner: '#B0E0E6',
      snack: '#AFEEEE',
      dessert: '#F0FFFF',
    },
    mealAccent: {
      breakfast: '#FF8C00',
      lunch: '#20B2AA',
      dinner: '#4682B4',
      snack: '#40E0D0',
      dessert: '#9370DB',
    },
    
    // Nutrition macro colors
    protein: '#DC143C',
    carbs: '#1E90FF',
    fat: '#FF8C00',
    fiber: '#20B2AA',
    
    // Special feature colors
    aiAccent: '#9370DB',
    premium: '#DAA520',
    link: '#4682B4',
    linkHover: '#2F4F4F',
  },
  
  green: {
    // Text colors
    text: '#1B4332',
    textSecondary: '#2D5A3D',
    textMuted: '#52796F',
    
    // Background colors
    background: '#F0FFF0',
    backgroundSecondary: '#F5FFFA',
    backgroundCard: '#FFFFFF',
    
    // Primary colors
    primary: '#228B22',
    primaryDark: '#006400',
    primaryLight: '#90EE90',
    
    // Secondary and accent
    secondary: '#32CD32',
    accent: '#90EE90',
    
    // Status colors
    success: '#00FF7F',
    warning: '#FFD700',
    danger: '#8B4513',
    error: '#8B4513',
    info: '#87CEEB',
    
    // Border and separator colors
    border: '#6B8E23',
    borderLight: '#ADDFAD',
    borderDark: '#90EE90',
    divider: '#F0FFF0',
    
    // Button colors
    button: '#F0FFF0',
    buttonSecondary: '#F5FFFA',
    buttonText: '#1B4332',
    buttonTextPrimary: '#ffffff',
    
    // Additional UI colors
    placeholder: '#52796F',
    shadow: 'rgba(27, 67, 50, 0.1)',
    shadowDark: 'rgba(27, 67, 50, 0.15)',
    
    // Tab colors
    tint: '#228B22',
    icon: '#2D5A3D',
    tabIconDefault: '#52796F',
    tabIconSelected: '#228B22',
    
    // Meal/Food specific colors
    starColor: '#FFD700',
    mealColors: {
      breakfast: '#F0FFF0',
      lunch: '#HONEYDEW',
      dinner: '#MINTCREAM',
      snack: '#F5FFFA',
      dessert: '#F0FFFF',
    },
    mealAccent: {
      breakfast: '#FFD700',
      lunch: '#00FF7F',
      dinner: '#228B22',
      snack: '#32CD32',
      dessert: '#DA70D6',
    },
    
    // Nutrition macro colors
    protein: '#8B4513',
    carbs: '#87CEEB',
    fat: '#FFD700',
    fiber: '#00FF7F',
    
    // Special feature colors
    aiAccent: '#DA70D6',
    premium: '#FFD700',
    link: '#228B22',
    linkHover: '#006400',
  },

  // DARK CATEGORY THEMES (dark backgrounds, light text)
  purple: {
    // Text colors
    text: '#E6E6FA',
    textSecondary: '#DDA0DD',
    textMuted: '#9370DB',
    
    // Background colors
    background: '#0F0A1A',
    backgroundSecondary: '#1A0D1F',
    backgroundCard: '#1F1535',
    
    // Primary colors
    primary: '#8A2BE2',
    primaryDark: '#4B0082',
    primaryLight: '#DA70D6',
    
    // Secondary and accent
    secondary: '#9370DB',
    accent: '#DA70D6',
    
    // Status colors
    success: '#40E0D0',
    warning: '#FFB6C1',
    danger: '#FF69B4',
    error: '#FF69B4',
    info: '#B19CD9',
    
    // Border and separator colors
    border: '#663399',
    borderLight: '#8A2BE2',
    borderDark: '#4B0082',
    divider: '#1A0D1F',
    
    // Button colors
    button: '#1F1535',
    buttonSecondary: '#1A0D1F',
    buttonText: '#E6E6FA',
    buttonTextPrimary: '#0F0A1A',
    
    // Additional UI colors
    placeholder: '#9370DB',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowDark: 'rgba(0, 0, 0, 0.5)',
    
    // Tab colors
    tint: '#8A2BE2',
    icon: '#DDA0DD',
    tabIconDefault: '#9370DB',
    tabIconSelected: '#8A2BE2',
    
    // Meal/Food specific colors
    starColor: '#FFD700',
    mealColors: {
      breakfast: '#2D1B69',
      lunch: '#8B008B',
      dinner: '#4B0082',
      snack: '#9932CC',
      dessert: '#8A2BE2',
    },
    mealAccent: {
      breakfast: '#FFD700',
      lunch: '#7FFFD4',
      dinner: '#6A5ACD',
      snack: '#EE82EE',
      dessert: '#DA70D6',
    },
    
    // Nutrition macro colors
    protein: '#FF69B4',
    carbs: '#B19CD9',
    fat: '#FFB6C1',
    fiber: '#40E0D0',
    
    // Special feature colors
    aiAccent: '#EE82EE',
    premium: '#FFD700',
    link: '#8A2BE2',
    linkHover: '#DA70D6',
  },
  
  orange: {
    // Text colors
    text: '#FFF7ED',
    textSecondary: '#FED7AA',
    textMuted: '#FDBA74',
    
    // Background colors
    background: '#7C2D12',
    backgroundSecondary: '#9A3412',
    backgroundCard: '#C2410C',
    
    // Primary colors
    primary: '#EA580C',
    primaryDark: '#9A3412',
    primaryLight: '#FED7AA',
    
    // Secondary and accent
    secondary: '#FB923C',
    accent: '#FED7AA',
    
    // Status colors
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    error: '#F87171',
    info: '#60A5FA',
    
    // Border and separator colors
    border: '#EA580C',
    borderLight: '#F97316',
    borderDark: '#C2410C',
    divider: '#9A3412',
    
    // Button colors
    button: '#C2410C',
    buttonSecondary: '#9A3412',
    buttonText: '#FFF7ED',
    buttonTextPrimary: '#7C2D12',
    
    // Additional UI colors
    placeholder: '#FDBA74',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowDark: 'rgba(0, 0, 0, 0.5)',
    
    // Tab colors
    tint: '#EA580C',
    icon: '#FED7AA',
    tabIconDefault: '#FDBA74',
    tabIconSelected: '#EA580C',
    
    // Meal/Food specific colors
    starColor: '#FFD700',
    mealColors: {
      breakfast: '#C2410C',
      lunch: '#EA580C',
      dinner: '#F97316',
      snack: '#FB923C',
      dessert: '#FDBA74',
    },
    mealAccent: {
      breakfast: '#FFD700',
      lunch: '#34D399',
      dinner: '#EA580C',
      snack: '#FBBF24',
      dessert: '#F87171',
    },
    
    // Nutrition macro colors
    protein: '#F87171',
    carbs: '#60A5FA',
    fat: '#FBBF24',
    fiber: '#34D399',
    
    // Special feature colors
    aiAccent: '#F87171',
    premium: '#FFD700',
    link: '#EA580C',
    linkHover: '#FED7AA',
  },
  
  pink: {
    // Text colors
    text: '#FDF2F8',
    textSecondary: '#F9A8D4',
    textMuted: '#F472B6',
    
    // Background colors
    background: '#7F1D1D',
    backgroundSecondary: '#9D174D',
    backgroundCard: '#BE185D',
    
    // Primary colors
    primary: '#DB2777',
    primaryDark: '#9D174D',
    primaryLight: '#F9A8D4',
    
    // Secondary and accent
    secondary: '#EC4899',
    accent: '#F9A8D4',
    
    // Status colors
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    error: '#F87171',
    info: '#60A5FA',
    
    // Border and separator colors
    border: '#DB2777',
    borderLight: '#EC4899',
    borderDark: '#BE185D',
    divider: '#9D174D',
    
    // Button colors
    button: '#BE185D',
    buttonSecondary: '#9D174D',
    buttonText: '#FDF2F8',
    buttonTextPrimary: '#7F1D1D',
    
    // Additional UI colors
    placeholder: '#F472B6',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowDark: 'rgba(0, 0, 0, 0.5)',
    
    // Tab colors
    tint: '#DB2777',
    icon: '#F9A8D4',
    tabIconDefault: '#F472B6',
    tabIconSelected: '#DB2777',
    
    // Meal/Food specific colors
    starColor: '#FFD700',
    mealColors: {
      breakfast: '#BE185D',
      lunch: '#DB2777',
      dinner: '#EC4899',
      snack: '#F472B6',
      dessert: '#F9A8D4',
    },
    mealAccent: {
      breakfast: '#FFD700',
      lunch: '#34D399',
      dinner: '#DB2777',
      snack: '#FBBF24',
      dessert: '#F87171',
    },
    
    // Nutrition macro colors
    protein: '#F87171',
    carbs: '#60A5FA',
    fat: '#FBBF24',
    fiber: '#34D399',
    
    // Special feature colors
    aiAccent: '#F87171',
    premium: '#FFD700',
    link: '#DB2777',
    linkHover: '#F9A8D4',
  },
  
  dark: {
    // Text colors
    text: '#F8FAFC',
    textSecondary: '#E2E8F0',
    textMuted: '#CBD5E1',
    
    // Background colors
    background: '#0F172A',
    backgroundSecondary: '#1E293B',
    backgroundCard: '#334155',
    
    // Primary colors
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    primaryLight: '#93C5FD',
    
    // Secondary and accent
    secondary: '#94A3B8',
    accent: '#20C997',
    
    // Status colors
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    error: '#F87171',
    info: '#60A5FA',
    
    // Border and separator colors
    border: '#475569',
    borderLight: '#64748B',
    borderDark: '#334155',
    divider: '#1E293B',
    
    // Button colors
    button: '#334155',
    buttonSecondary: '#1E293B',
    buttonText: '#F8FAFC',
    buttonTextPrimary: '#0F172A',
    
    // Additional UI colors
    placeholder: '#94A3B8',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowDark: 'rgba(0, 0, 0, 0.5)',
    
    // Tab colors
    tint: '#60A5FA',
    icon: '#E2E8F0',
    tabIconDefault: '#CBD5E1',
    tabIconSelected: '#60A5FA',
    
    // Meal/Food specific colors
    starColor: '#FBBF24',
    mealColors: {
      breakfast: '#334155',
      lunch: '#475569',
      dinner: '#64748B',
      snack: '#94A3B8',
      dessert: '#CBD5E1',
    },
    mealAccent: {
      breakfast: '#FBBF24',
      lunch: '#34D399',
      dinner: '#60A5FA',
      snack: '#F87171',
      dessert: '#A78BFA',
    },
    
    // Nutrition macro colors
    protein: '#F87171',
    carbs: '#60A5FA',
    fat: '#FBBF24',
    fiber: '#34D399',
    
    // Special feature colors
    aiAccent: '#A78BFA',
    premium: '#FBBF24',
    link: '#60A5FA',
    linkHover: '#93C5FD',
  },
};

// Create complete themes
function createTheme(themeVariant: ThemeVariant, fontFamily: FontFamily, fontSize: FontSize) {
  const colors = themeColors[themeVariant];
  const fonts = baseFontSizes[fontSize];
  const currentFontFamily = fontFamilies[fontFamily];
  
  // Determine if theme is in dark category for additional styling
  const isDarkCategory = themeCategories.dark.includes(themeVariant);
  
  return {
    ...colors,
    
    // Legacy compatibility - map old names to new structure
    card: colors.backgroundCard,
    cardSecondary: colors.backgroundSecondary,
    subtext: colors.textMuted,
    
    // Status light colors with transparency
    successLight: colors.success + '20',
    dangerLight: colors.danger + '20',
    warningLight: colors.warning + '20',
    infoLight: colors.info + '20',
    
    // Rating and feedback
    ratingActive: colors.starColor,
    ratingInactive: colors.border,
    
    // Font sizes
    fonts,
    
    // Font families
    fontFamily: {
      primary: currentFontFamily,
      secondary: fontFamilies.system,
      heading: currentFontFamily,
      body: currentFontFamily,
    },
  };
}

// Default themes
const defaultTheme = createTheme('light', 'system', 'regular');

interface ThemeContextType {
  theme: ReturnType<typeof createTheme>;
  themeVariant: ThemeVariant;
  fontFamily: FontFamily;
  fontSize: FontSize;
  setThemeVariant: (variant: ThemeVariant) => void;
  setFontFamily: (family: FontFamily) => void;
  setFontSize: (size: FontSize) => void;
  availableThemes: ThemeVariant[];
  availableFontFamilies: FontFamily[];
  availableFontSizes: FontSize[];
  isLightCategory: boolean;
  isDarkCategory: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  themeVariant: 'light',
  fontFamily: 'system',
  fontSize: 'regular',
  setThemeVariant: () => {},
  setFontFamily: () => {},
  setFontSize: () => {},
  availableThemes: Object.keys(themeColors) as ThemeVariant[],
  availableFontFamilies: Object.keys(fontFamilies) as FontFamily[],
  availableFontSizes: Object.keys(baseFontSizes) as FontSize[],
  isLightCategory: true,
  isDarkCategory: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeVariant, setThemeVariantState] = useState<ThemeVariant>('light');
  const [fontFamily, setFontFamilyState] = useState<FontFamily>('system');
  const [fontSize, setFontSizeState] = useState<FontSize>('regular');

  // Load settings from AsyncStorage when the app starts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedThemeVariant = await AsyncStorage.getItem('themeVariant');
        const storedFontFamily = await AsyncStorage.getItem('fontFamily');
        const storedFontSize = await AsyncStorage.getItem('fontSize');
        
        if (storedThemeVariant && Object.keys(themeColors).includes(storedThemeVariant)) {
          setThemeVariantState(storedThemeVariant as ThemeVariant);
        }
        
        if (storedFontFamily && Object.keys(fontFamilies).includes(storedFontFamily)) {
          setFontFamilyState(storedFontFamily as FontFamily);
        }
        
        if (storedFontSize && Object.keys(baseFontSizes).includes(storedFontSize)) {
          setFontSizeState(storedFontSize as FontSize);
        }
      } catch (error) {
        console.error('Error loading theme settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Set theme variant
  const setThemeVariant = async (variant: ThemeVariant) => {
    setThemeVariantState(variant);
    try {
      await AsyncStorage.setItem('themeVariant', variant);
    } catch (error) {
      console.error('Error saving theme variant:', error);
    }
  };

  // Set font family
  const setFontFamily = async (family: FontFamily) => {
    setFontFamilyState(family);
    try {
      await AsyncStorage.setItem('fontFamily', family);
    } catch (error) {
      console.error('Error saving font family:', error);
    }
  };

  // Set font size
  const setFontSize = async (size: FontSize) => {
    setFontSizeState(size);
    try {
      await AsyncStorage.setItem('fontSize', size);
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };

  // Create current theme
  const currentTheme = createTheme(themeVariant, fontFamily, fontSize);
  
  // Determine theme category
  const isLightCategory = themeCategories.light.includes(themeVariant);
  const isDarkCategory = themeCategories.dark.includes(themeVariant);

  const contextValue: ThemeContextType = {
    theme: currentTheme,
    themeVariant,
    fontFamily,
    fontSize,
    setThemeVariant,
    setFontFamily,
    setFontSize,
    availableThemes: Object.keys(themeColors) as ThemeVariant[],
    availableFontFamilies: Object.keys(fontFamilies) as FontFamily[],
    availableFontSizes: Object.keys(baseFontSizes) as FontSize[],
    isLightCategory,
    isDarkCategory,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);