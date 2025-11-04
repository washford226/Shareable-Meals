import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RevenueCatDebug } from '../../../components/RevenueCatDebug';
import { useTheme } from '../../../context/ThemeContext';

export default function RevenueCatTestScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RevenueCatDebug />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});