import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useRevenueCat } from '../../../context/RevenueCatContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Paywall } from '../../../components/Paywall';

export default function CreateMealIndexPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { isPremium } = useRevenueCat();
  const [showPaywall, setShowPaywall] = useState(false);

  const createOptions = [
    {
      id: 'ai',
      title: 'AI-Generated Recipe',
      subtitle: 'Describe what you want and let AI create a custom recipe',
      icon: 'sparkles' as keyof typeof Ionicons.glyphMap,
      color: theme.primary,
      route: '/(main)/create-meal/ai',
      isPremium: true,
    },
    {
      id: 'manual',
      title: 'Manual Entry',
      subtitle: 'Create your own recipe from scratch',
      icon: 'create' as keyof typeof Ionicons.glyphMap,
      color: theme.success,
      route: '/(main)/create-meal/manual',
      isPremium: false,
    },
    {
      id: 'url',
      title: 'Import from URL',
      subtitle: 'Import a recipe from a website link',
      icon: 'link' as keyof typeof Ionicons.glyphMap,
      color: theme.warning,
      route: '/(main)/create-meal/url',
      isPremium: true,
    },
  ];

  const handleOptionPress = (option: typeof createOptions[0]) => {
    // Check if this is a premium feature and user doesn't have premium
    if (option.isPremium && !isPremium) {
      console.log('Premium feature accessed, showing paywall');
      setShowPaywall(true);
      return;
    }

    console.log('Navigating to:', option.route);
    router.push(option.route as any);
  };

  const renderCreateOption = (option: typeof createOptions[0]) => {
    const isLocked = option.isPremium && !isPremium;
    
    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.optionCard, 
          { backgroundColor: theme.card },
          isLocked && { opacity: 0.8 }
        ]}
        onPress={() => handleOptionPress(option)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
          <Ionicons name={option.icon} size={28} color={option.color} />
          {isLocked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={16} color="white" />
            </View>
          )}
        </View>
        <View style={styles.optionContent}>
          <View style={styles.optionHeader}>
            <Text style={[styles.optionTitle, { color: theme.text }]}>
              {option.title}
            </Text>
            {isLocked && (
              <View style={[styles.premiumBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            )}
          </View>
          <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
            {isLocked 
              ? 'Unlock premium features to access this option'
              : option.subtitle
            }
          </Text>
        </View>
        <Ionicons 
          name={isLocked ? "lock-closed" : "chevron-forward"} 
          size={20} 
          color={isLocked ? theme.primary : theme.textSecondary} 
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>
          Create New Meal
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            How would you like to create your meal?
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Choose the method that works best for you
          </Text>
        </View>

        {/* Creation Options */}
        <View style={styles.optionsContainer}>
          {createOptions.map(renderCreateOption)}
        </View>

        {/* Tips Section */}
        <View style={[styles.tipsSection, { backgroundColor: theme.card }]}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={20} color={theme.primary} />
            <Text style={[styles.tipsTitle, { color: theme.text }]}>
              Tips for Better Recipes
            </Text>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                Include specific quantities and measurements
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                Add clear step-by-step instructions
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                Include cooking time and difficulty level
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                Add high-quality photos when possible
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Paywall Modal */}
      <Paywall 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)} 
      />
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
    ...theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.fonts.largeTitle,
    fontFamily: theme.fontFamily.heading,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  premiumBadgeText: {
    color: 'white',
    ...theme.fonts.tiny,
    fontFamily: theme.fontFamily.heading,
  },
  lockOverlay: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 2,
  },
  optionTitle: {
    ...theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  optionSubtitle: {
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    lineHeight: 20,
  },
  tipsSection: {
    marginHorizontal: 20,
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tipsTitle: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
    marginLeft: 8,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    flex: 1,
    lineHeight: 20,
  },
});