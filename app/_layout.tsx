// app/_layout.tsx
import "../polyfills"; // Import polyfills first
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";
import { useDataPreloader } from "../utils/appDataPreloader";

export default function Layout() {
  // Enable automatic data preloading
  useDataPreloader(true);

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
