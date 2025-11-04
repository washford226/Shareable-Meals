import React from 'react';
import { Stack } from 'expo-router';

export default function CreateMealLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="manual" />
      <Stack.Screen name="url" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}