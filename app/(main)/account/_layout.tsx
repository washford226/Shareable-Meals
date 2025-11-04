import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';

export default function AccountLayout() {
  const { theme } = useTheme();

  return (
    <Stack>
      <Stack.Screen 
        name="edit-profile" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="edit-email" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="theme-settings" 
        options={{ 
          headerShown: false 
        }} 
      />
    </Stack>
  );
}