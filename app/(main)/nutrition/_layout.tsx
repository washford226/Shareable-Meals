import React from 'react';
import { Stack } from 'expo-router';

export default function NutritionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="daily" />
      <Stack.Screen name="weekly" />
      <Stack.Screen name="monthly" />
    </Stack>
  );
}