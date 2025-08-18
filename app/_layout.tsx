// app/_layout.tsx
import "../polyfills"; // Import polyfills first
import React from "react";
import { Stack } from "expo-router";
import { View, Platform, StatusBar } from "react-native";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { useDataPreloader } from "../utils/appDataPreloader";

function AppContent() {
  const { theme } = useTheme();
  
  // Determine if we're in dark mode by checking the background color
  const isDarkMode = theme.background === '#0f172a'; // Dark theme background
  
  return (
    <View style={{ flex: 1 }}>
      {/* Dynamic Status Bar based on theme */}
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
        translucent={false}
      />
      <Stack 
        screenOptions={{ 
          headerShown: false,
          // Performance optimizations for faster navigation
          animation: 'slide_from_right',
          animationDuration: 200, // Faster transitions (default is 350ms)
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }} 
      />
    </View>
  );
}

export default function Layout() {
  // Enable automatic data preloading
  useDataPreloader(true);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
