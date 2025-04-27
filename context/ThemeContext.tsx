import React, { createContext, useState, useEffect, useContext } from 'react';
import { Appearance } from 'react-native';

const lightTheme = {
  background: '#ffffff',
  text: '#000000',
  button: '#007bff',
  buttonText: '#ffffff',
  border: '#cccccc', // Light gray for borders
  placeholder: '#888888', // Gray for placeholder text
  card: '#f8f9fa', // Light card background
  subtext: '#6c757d', // Muted text color
  primary: '#007bff', // Primary color for highlights or loading indicators
  danger: '#dc3545', // Red for destructive actions like delete or cancel
  warning: '#ffc107', // Yellow for less critical actions like warnings
  starColor: '#FFD700', // Gold for star ratings
  mealColors: { // Colors for different meal types
    breakfast: '#ff6f61', // Red for breakfast
    lunch: '#4caf50', // Green for lunch
    dinner: '#2196f3', // Blue for dinner
    other: '#9c27b0', // Purple for other
  },
  mealText: '#ffffff', // White text for meal blocks
  link: '#007bff', // Blue for clickable links
};

const darkTheme = {
  background: '#000000',
  text: '#ffffff',
  button: '#444444',
  buttonText: '#ffffff',
  border: '#444444', // Dark gray for borders
  placeholder: '#aaaaaa', // Light gray for placeholder text
  card: '#1c1c1e', // Dark card background
  subtext: '#aaaaaa', // Muted text color
  primary: '#1e90ff', // Primary color for highlights or loading indicators
  danger: '#ff4d4f', // Bright red for destructive actions
  warning: '#ffcc00', // Yellow for less critical actions
  starColor: '#FFD700', // Gold for star ratings
  mealColors: { // Colors for different meal types
    breakfast: '#ff6f61', // Red for breakfast
    lunch: '#4caf50', // Green for lunch
    dinner: '#2196f3', // Blue for dinner
    other: '#9c27b0', // Purple for other
  },
  mealText: '#ffffff', // White text for meal blocks
  link: '#1e90ff', // Bright blue for clickable links
};

const ThemeContext = createContext({
  theme: lightTheme,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState(
    Appearance.getColorScheme() === 'dark' ? darkTheme : lightTheme
  );

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === lightTheme ? darkTheme : lightTheme));
  };

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme === 'dark' ? darkTheme : lightTheme);
    });

    return () => listener.remove();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);