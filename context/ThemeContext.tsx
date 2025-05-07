import React, { createContext, useState, useEffect, useContext } from 'react';
import { Appearance } from 'react-native';

const lightTheme = {
  background: '#f5f5f5', // Light gray background for the screen
  text: '#000000', // Black text
  button: '#ffffff', // White background for buttons
  buttonText: '#000000', // Black text for buttons
  border: '#cccccc', // Light gray for borders
  placeholder: '#888888', // Gray for placeholder text
  card: '#f8f9fa', // Light card background
  subtext: '#1a1a1a', // Muted text color
  primary: '#007bff', // Blue for switch thumb
  danger: '#dc3545', // Red for destructive actions like delete or cancel
  warning: '#ffc107', // Yellow for less critical actions like warnings
  starColor: '#FFD700', // Gold for star ratings
  mealColors: { // Colors for different meal types
    breakfast: '#ffffff',
    lunch: '#ffffff',
    dinner: '#ffffff',
    other: '#ffffff',
  },
  
  mealText: '#000000', // Black text for meal blocks
  link: '#007bff', // Blue for clickable links
};

const darkTheme = {
  background: '#121212', // Dark gray background for the screen
  text: '#ffffff', // White text
  button: '#333333', // Dark gray background for buttons
  buttonText: '#ffffff', // White text for buttons
  border: '#444444', // Dark gray for borders
  placeholder: '#aaaaaa', // Light gray for placeholder text
  card: '#1c1c1e', // Dark card background
  subtext: '#aaaaaa', // Muted text color
  primary: '#1e90ff', // Blue for switch thumb
  danger: '#ff4d4f', // Bright red for destructive actions
  warning: '#ffcc00', // Yellow for less critical actions
  starColor: '#FFD700', // Gold for star ratings
  mealColors: { // Colors for different meal types
    breakfast: '#000000',
    lunch: '#000000',
    dinner: '#000000',
    other: '#000000',
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