import React from "react";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        // Optimized settings for in-app navigation
        animation: 'slide_from_right',
        animationDuration: 150, // Even faster for internal navigation
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        // Enable swipe gestures for better UX
        fullScreenGestureEnabled: true,
      }} 
    />
  );
}
