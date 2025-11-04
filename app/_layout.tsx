import "../polyfills"; // Import polyfills first
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, Platform, StatusBar } from "react-native";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { RevenueCatProvider } from "../context/RevenueCatContext";
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { theme } = useTheme();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  // Determine if we're in dark mode by checking the background color
  const isDarkMode = theme.background === '#0f172a'; // Dark theme background
  
  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
          // Add more fonts here as you get them
          // 'SpaceMono-Bold': require('../assets/fonts/SpaceMono-Bold.ttf'),
          // 'CustomFont-Light': require('../assets/fonts/CustomFont-Light.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.warn('Error loading fonts:', error);
        setFontsLoaded(true); // Continue anyway
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }
  
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
          gestureEnabled: false, // Disable swipe to go back
          gestureDirection: 'horizontal',
          presentation: 'card',
        }} 
      />
    </View>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <RevenueCatProvider>
        <AppContent />
      </RevenueCatProvider>
    </ThemeProvider>
  );
}
