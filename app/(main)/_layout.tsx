import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Performance optimizations for faster navigation
        animation: 'slide_from_right',
        animationDuration: 200, // Faster transitions (default is 350ms)
        gestureEnabled: true, // Enable swipe to go back
        gestureDirection: 'horizontal',
        presentation: 'card',
      }}
    >
      {/* Tab-based navigation */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false 
        }} 
      />
      
      {/* Modal/Overlay screens */}
      <Stack.Screen 
        name="create-meal" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      
      {/* Full-screen navigation screens */}
      <Stack.Screen 
        name="ai" 
        options={{ 
          headerShown: false 
        }} 
      />
      
      <Stack.Screen 
        name="competition" 
        options={{ 
          headerShown: false 
        }} 
      />
      
      <Stack.Screen 
        name="meal-info" 
        options={{ 
          headerShown: false 
        }} 
      />
      
      <Stack.Screen 
        name="nutrition" 
        options={{ 
          headerShown: false 
        }} 
      />
    </Stack>
  );
}