import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';

// TODO: Import subscription context to check if user has premium access
// import { useSubscription } from '../../../context/SubscriptionContext';

export default function AILayout() {
  const { theme } = useTheme();
  // const { hasActiveSubscription } = useSubscription();

  // TODO: Add paywall guard here
  // if (!hasActiveSubscription) {
  //   return <PaywallComponent />;
  // }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="meal-scanner" />
    </Stack>
  );
}