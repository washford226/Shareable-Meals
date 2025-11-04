import React from 'react';
import { Stack } from 'expo-router';

export default function CompetitionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="current" />
      <Stack.Screen name="add-meal" />
      <Stack.Screen name="leaderboard" />
    </Stack>
  );
}