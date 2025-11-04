import React from 'react';
import { Stack } from 'expo-router';

export default function MealInfoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="competition" />
      <Stack.Screen name="discover" />
      <Stack.Screen name="my-meals" />
    </Stack>
  );
}