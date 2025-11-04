import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function NutritionIndexPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>
          Nutrition Tracking
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: theme.card }]}
          onPress={() => router.push('./daily')}
        >
          <Ionicons name="today" size={24} color={theme.primary} />
          <Text style={[styles.optionTitle, { color: theme.text }]}>
            Daily Nutrition
          </Text>
          <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
            View today's nutrition breakdown
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: theme.card }]}
          onPress={() => router.push('./weekly')}
        >
          <Ionicons name="stats-chart" size={24} color={theme.primary} />
          <Text style={[styles.optionTitle, { color: theme.text }]}>
            Weekly Overview
          </Text>
          <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
            See your week's nutrition trends
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: theme.card }]}
          onPress={() => router.push('./monthly')}
        >
          <Ionicons name="calendar" size={24} color={theme.primary} />
          <Text style={[styles.optionTitle, { color: theme.text }]}>
            Monthly Summary
          </Text>
          <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
            Review your monthly progress
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  optionTitle: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    flex: 1,
  },
  optionSubtitle: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginTop: 4,
    flex: 2,
  },
});