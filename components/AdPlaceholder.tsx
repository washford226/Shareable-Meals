import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';

const isExpoGo = Constants.appOwnership === 'expo';

interface AdPlaceholderProps {
  style?: any;
}

export function AdPlaceholder({ style }: AdPlaceholderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.card }, style]}>
      <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
        📱 Ad Placeholder (Expo Go)
      </Text>
      <Text style={[styles.placeholderSubtext, { color: theme.textSecondary }]}>
        Real ads will show in production build
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});