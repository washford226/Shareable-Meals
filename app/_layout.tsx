// app/_layout.tsx
import "../polyfills"; // Import polyfills first
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";

export default function Layout() {
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
