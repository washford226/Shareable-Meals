import React, { createContext, useState, useEffect, useContext } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const lightTheme = {
  // Backgrounds
  background: '#fafafa', // Softer, warmer light background
  card: '#ffffff', // Pure white for cards with subtle shadows
  cardSecondary: '#f8f9fc', // Very light blue-gray for secondary cards
  
  // Text colors
  text: '#1a1a1a', // Softer black for better readability
  textSecondary: '#6b7280', // Modern gray for secondary text
  subtext: '#9ca3af', // Lighter gray for subtitles and captions
  placeholder: '#9ca3af', // Consistent with subtext
  
  // Buttons and interactive elements
  primary: '#3b82f6', // Modern blue (Tailwind blue-500)
  primaryDark: '#2563eb', // Darker blue for pressed states
  primaryLight: '#dbeafe', // Light blue for backgrounds
  button: '#ffffff', // White button background
  buttonSecondary: '#f3f4f6', // Light gray for secondary buttons
  buttonText: '#1a1a1a', // Dark text on light buttons
  buttonTextPrimary: '#ffffff', // White text on primary buttons
  
  // Status colors
  success: '#10b981', // Modern green (Tailwind emerald-500)
  successLight: '#d1fae5', // Light green background
  danger: '#ef4444', // Modern red (Tailwind red-500)
  dangerLight: '#fee2e2', // Light red background
  warning: '#f59e0b', // Modern amber (Tailwind amber-500)
  warningLight: '#fef3c7', // Light amber background
  info: '#06b6d4', // Modern cyan (Tailwind cyan-500)
  infoLight: '#cffafe', // Light cyan background
  
  // Borders and dividers
  border: '#e5e7eb', // Light gray border (Tailwind gray-200)
  borderDark: '#d1d5db', // Slightly darker border (Tailwind gray-300)
  divider: '#f3f4f6', // Very light divider
  
  // Food/meal specific colors
  starColor: '#fbbf24', // Warmer gold (Tailwind amber-400)
  mealColors: { // Subtle, food-inspired colors
    breakfast: '#fff7ed', // Light orange (sunrise/morning)
    lunch: '#f0fdf4', // Light green (fresh/midday)
    dinner: '#fdf2f8', // Light pink (evening/sunset)
    other: '#f8fafc', // Light blue-gray (neutral)
    scanned: '#fef3c7', // Light amber for AI-scanned meals
  },
  mealText: '#1a1a1a', // Consistent with main text
  mealAccent: { // Accent colors for meal categories
    breakfast: '#fb923c', // Orange accent
    lunch: '#22c55e', // Green accent
    dinner: '#ec4899', // Pink accent
    other: '#64748b', // Gray accent
    scanned: '#f59e0b', // Amber accent for scanned meals
  },
  
  // Nutrition macro colors
  protein: '#dc2626', // Red for protein
  carbs: '#2563eb', // Blue for carbs 
  fat: '#ca8a04', // Amber/yellow for fat
  
  // Interactive states
  link: '#3b82f6', // Consistent with primary
  linkHover: '#2563eb', // Darker on hover
  
  // Shadows and elevation
  shadow: 'rgba(0, 0, 0, 0.1)', // Subtle shadow
  shadowDark: 'rgba(0, 0, 0, 0.15)', // Slightly stronger shadow
  
  // AI/Premium features
  aiAccent: '#8b5cf6', // Purple for AI features (Tailwind violet-500)
  aiLight: '#f3f4f6', // Light background for AI sections
  premium: '#f59e0b', // Gold for premium features
  
  // Rating and feedback
  ratingActive: '#fbbf24', // Active star color
  ratingInactive: '#e5e7eb', // Inactive star color
}

const darkTheme = {
  // Backgrounds
  background: '#0f172a', // Deep dark blue-gray
  card: '#1e293b', // Dark card background
  cardSecondary: '#334155', // Lighter dark for secondary cards
  
  // Text colors
  text: '#f8fafc', // Soft white for readability
  textSecondary: '#cbd5e1', // Light gray for secondary text
  subtext: '#94a3b8', // Medium gray for subtitles
  placeholder: '#64748b', // Darker gray for placeholders
  
  // Buttons and interactive elements
  primary: '#3b82f6', // Same blue as light theme
  primaryDark: '#2563eb', // Darker blue for pressed states
  primaryLight: '#1e40af', // Darker version for dark theme
  button: '#374151', // Dark gray button background
  buttonSecondary: '#4b5563', // Lighter dark gray
  buttonText: '#f8fafc', // Light text on dark buttons
  buttonTextPrimary: '#ffffff', // White text on primary buttons
  
  // Status colors
  success: '#10b981', // Same green
  successLight: '#064e3b', // Dark green background
  danger: '#ef4444', // Same red
  dangerLight: '#7f1d1d', // Dark red background
  warning: '#f59e0b', // Same amber
  warningLight: '#78350f', // Dark amber background
  info: '#06b6d4', // Same cyan
  infoLight: '#164e63', // Dark cyan background
  
  // Borders and dividers
  border: '#475569', // Medium gray border
  borderDark: '#334155', // Darker border
  divider: '#334155', // Consistent divider
  
  // Food/meal specific colors
  starColor: '#fbbf24', // Same warm gold
  mealColors: { // Dark versions of meal colors
    breakfast: '#431407', // Dark orange
    lunch: '#14532d', // Dark green
    dinner: '#831843', // Dark pink
    other: '#1e293b', // Dark blue-gray
    scanned: '#78350f', // Dark amber for AI-scanned meals
  },
  mealText: '#f8fafc', // Light text
  mealAccent: { // Same accent colors work in dark
    breakfast: '#fb923c',
    lunch: '#22c55e',
    dinner: '#ec4899',
    other: '#94a3b8',
    scanned: '#f59e0b', // Amber accent for scanned meals
  },
  
  // Nutrition macro colors
  protein: '#f87171', // Lighter red for dark theme
  carbs: '#60a5fa', // Lighter blue for dark theme
  fat: '#fbbf24', // Lighter amber for dark theme
  
  // Interactive states
  link: '#60a5fa', // Lighter blue for dark theme
  linkHover: '#3b82f6', // Medium blue on hover
  
  // Shadows and elevation
  shadow: 'rgba(0, 0, 0, 0.3)', // Stronger shadow for dark theme
  shadowDark: 'rgba(0, 0, 0, 0.5)', // Even stronger shadow
  
  // AI/Premium features
  aiAccent: '#a855f7', // Lighter purple for dark theme
  aiLight: '#2d1b69', // Dark purple background
  premium: '#f59e0b', // Same gold
  
  // Rating and feedback
  ratingActive: '#fbbf24', // Same active star
  ratingInactive: '#475569', // Dark inactive star
};

const ThemeContext = createContext({
  theme: lightTheme,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState(lightTheme);

  // Load the theme from AsyncStorage when the app starts
  useEffect(() => {
    const loadTheme = async () => {
      const storedMode = await AsyncStorage.getItem('themeMode');
      if (storedMode === 'dark') {
        setTheme(darkTheme);
      } else {
        setTheme(lightTheme);
      }
    };
    loadTheme();
  }, []);

  // Toggle the theme and save the mode in AsyncStorage
  const toggleTheme = async () => {
    const newTheme = theme === lightTheme ? darkTheme : lightTheme;
    const newMode = newTheme === darkTheme ? 'dark' : 'light';
    await AsyncStorage.setItem('themeMode', newMode);
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);