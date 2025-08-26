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
        gestureEnabled: false, // Disable swipe to go back
        gestureDirection: 'horizontal',
        // Disable all swipe gestures for more controlled navigation
        fullScreenGestureEnabled: false,
        presentation: 'card',
      }} 
    />
  );
}
