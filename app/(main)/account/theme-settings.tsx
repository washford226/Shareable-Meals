import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeVariant, FontFamily, FontSize, themeCategories } from '../../../context/ThemeContext';
import { useRevenueCat } from '../../../context/RevenueCatContext';
import { Paywall } from '../../../components/Paywall';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme options with display information and premium status
const themeOptions: Array<{
  key: ThemeVariant;
  name: string;
  color: string;
  description: string;
  category: 'light' | 'dark';
  isPremium: boolean;
}> = [
  { key: 'light', name: 'Light', color: '#3b82f6', description: 'Classic light theme', category: 'light', isPremium: false },
  { key: 'dark', name: 'Dark', color: '#60a5fa', description: 'Default dark theme', category: 'dark', isPremium: false },
  { key: 'blue', name: 'Blue Ocean', color: '#1e40af', description: 'Calming blue theme', category: 'light', isPremium: true },
  { key: 'green', name: 'Forest Green', color: '#065f46', description: 'Fresh and natural', category: 'light', isPremium: true },
  { key: 'purple', name: 'Royal Purple', color: '#a78bfa', description: 'Creative and elegant', category: 'dark', isPremium: true },
  { key: 'orange', name: 'Sunset Orange', color: '#fb923c', description: 'Warm and energetic', category: 'dark', isPremium: true },
  { key: 'pink', name: 'Rose Pink', color: '#f472b6', description: 'Playful and vibrant', category: 'dark', isPremium: true },
];

// Font family options with premium status
const fontFamilyOptions: Array<{
  key: FontFamily;
  name: string;
  description: string;
  isPremium: boolean;
  fontPreviewFamily: string;
}> = [
  { key: 'system', name: 'System', description: 'Default system font', isPremium: false, fontPreviewFamily: 'System' },
  { key: 'spacemono', name: 'Space Mono', description: 'Monospace coding font', isPremium: true, fontPreviewFamily: 'SpaceMono-Regular' },
  { key: 'dancingscript', name: 'Dancing Script', description: 'Elegant handwritten style', isPremium: true, fontPreviewFamily: 'DancingScript-Regular' },
  { key: 'medievalsharp', name: 'Medieval Sharp', description: 'Gothic medieval style', isPremium: true, fontPreviewFamily: 'MedievalSharp-Regular' },
  { key: 'opensans', name: 'Open Sans', description: 'Clean and readable sans-serif', isPremium: true, fontPreviewFamily: 'OpenSans-Regular' },
  { key: 'roboto', name: 'Roboto', description: 'Modern Google font', isPremium: true, fontPreviewFamily: 'Roboto-Regular' },
];

// Font size options
const fontSizeOptions: Array<{
  key: FontSize;
  name: string;
  description: string;
}> = [
  { key: 'small', name: 'Small', description: 'Compact text for more content' },
  { key: 'regular', name: 'Regular', description: 'Standard comfortable reading' },
  { key: 'large', name: 'Large', description: 'Easier reading for accessibility' },
];

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  mainTitle: {
    fontSize: theme.fonts.largeTitle,
    fontFamily: theme.fontFamily.bold,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.medium,
    marginBottom: 12,
  },
  previewCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 8,
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginLeft: 12,
  },
  previewCategory: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeOption: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    position: 'relative',
  },
  themeOptionLocked: {
    opacity: 0.6,
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  lockIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorPreview: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
  },
  fontGrid: {
    gap: 8,
  },
  fontOption: {
    padding: 16,
    borderRadius: 12,
    position: 'relative',
  },
  fontOptionLocked: {
    opacity: 0.6,
  },
  fontOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fontInfo: {
    flex: 1,
  },
  fontName: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 4,
  },
  fontDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginBottom: 4,
  },
  sampleText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
});

export default function ThemeSettingsPage() {
  const { 
    theme, 
    themeVariant, 
    fontFamily, 
    fontSize, 
    setThemeVariant, 
    setFontFamily, 
    setFontSize,
    isLightCategory,
    isDarkCategory
  } = useTheme();
  const { isPremium } = useRevenueCat();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string>('');
  
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  // Calculate tab bar height for proper content padding
  const tabBarHeight = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10) + (Platform.OS === 'ios' ? 65 : 60);

  // Handle theme selection with premium check
  const handleThemeSelect = (themeKey: ThemeVariant, themeName: string, isPremiumTheme: boolean) => {
    if (isPremiumTheme && !isPremium) {
      setPaywallFeature(`${themeName} Theme`);
      setShowPaywall(true);
    } else {
      setThemeVariant(themeKey);
    }
  };

  // Handle font family selection with premium check
  const handleFontSelect = (fontKey: FontFamily, fontName: string, isPremiumFont: boolean) => {
    if (isPremiumFont && !isPremium) {
      setPaywallFeature(`${fontName} Font`);
      setShowPaywall(true);
    } else {
      setFontFamily(fontKey);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Simplified Header - Just back button */}
      <SafeAreaView edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.buttonSecondary }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme & Appearance Title as first section */}
        <View style={styles.titleSection}>
          <Text style={[styles.mainTitle, { color: theme.text, fontSize: theme.fonts.largeTitle, fontFamily: theme.fontFamily.heading }]}>
            Theme & Appearance
          </Text>
        </View>
        {/* Current Theme Preview */}
        <View style={styles.section}>
          <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.previewTitle, { color: theme.text, fontSize: theme.fonts.headline, fontFamily: theme.fontFamily.heading }]}>
              Current Theme Preview
            </Text>
            <View style={styles.previewInfo}>
              <View style={[styles.colorPreview, { backgroundColor: theme.primary }]} />
              <Text style={[styles.previewText, { color: theme.text, fontSize: theme.fonts.body, fontFamily: theme.fontFamily.body }]}>
                {themeOptions.find(t => t.key === themeVariant)?.name} • {fontFamilyOptions.find(f => f.key === fontFamily)?.name} • {fontSizeOptions.find(s => s.key === fontSize)?.name}
              </Text>
            </View>
            <Text style={[styles.previewCategory, { color: theme.textSecondary, fontSize: theme.fonts.footnote, fontFamily: theme.fontFamily.body }]}>
              Category: {isLightCategory ? 'Light Theme' : 'Dark Theme'}
            </Text>
          </View>
        </View>

        {/* Theme Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: theme.fonts.title3, fontFamily: theme.fontFamily.heading }]}>
            Color Themes
          </Text>
          
          {/* Light Category Themes */}
          <Text style={[styles.categoryTitle, { color: theme.textSecondary, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
            Light Themes (Dark Text)
          </Text>
          <View style={styles.themeGrid}>
            {themeOptions.filter(option => option.category === 'light').map((option) => {
              const isLocked = option.isPremium && !isPremium;
              const isSelected = themeVariant === option.key;
              
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleThemeSelect(option.key, option.name, option.isPremium)}
                  style={[
                    styles.themeOption,
                    isLocked && styles.themeOptionLocked,
                    { 
                      backgroundColor: isSelected ? theme.primaryLight : theme.cardSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                      borderWidth: isSelected ? 2 : 1,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeOptionContent}>
                    <View style={[styles.colorPreview, { backgroundColor: option.color }]} />
                    <View style={styles.themeInfo}>
                      <Text style={[styles.themeName, { color: theme.text, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
                        {option.name}
                      </Text>
                      <Text style={[styles.themeDescription, { color: theme.textSecondary, fontSize: theme.fonts.caption, fontFamily: theme.fontFamily.body }]}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Premium Badge */}
                  {option.isPremium && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="star" size={10} color="#000" />
                      <Text style={styles.premiumBadgeText}>PRO</Text>
                    </View>
                  )}
                  
                  {/* Lock Icon for non-premium users */}
                  {isLocked && (
                    <View style={styles.lockIcon}>
                      <Ionicons name="lock-closed" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dark Category Themes */}
          <Text style={[styles.categoryTitle, { color: theme.textSecondary, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body, marginTop: 24 }]}>
            Dark Themes (Light Text)
          </Text>
          <View style={styles.themeGrid}>
            {themeOptions.filter(option => option.category === 'dark').map((option) => {
              const isLocked = option.isPremium && !isPremium;
              const isSelected = themeVariant === option.key;
              
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleThemeSelect(option.key, option.name, option.isPremium)}
                  style={[
                    styles.themeOption,
                    isLocked && styles.themeOptionLocked,
                    { 
                      backgroundColor: isSelected ? theme.primaryLight : theme.cardSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                      borderWidth: isSelected ? 2 : 1,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeOptionContent}>
                    <View style={[styles.colorPreview, { backgroundColor: option.color }]} />
                    <View style={styles.themeInfo}>
                      <Text style={[styles.themeName, { color: theme.text, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
                        {option.name}
                      </Text>
                      <Text style={[styles.themeDescription, { color: theme.textSecondary, fontSize: theme.fonts.caption, fontFamily: theme.fontFamily.body }]}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Premium Badge */}
                  {option.isPremium && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="star" size={10} color="#000" />
                      <Text style={styles.premiumBadgeText}>PRO</Text>
                    </View>
                  )}
                  
                  {/* Lock Icon for non-premium users */}
                  {isLocked && (
                    <View style={styles.lockIcon}>
                      <Ionicons name="lock-closed" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Font Family Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: theme.fonts.title3, fontFamily: theme.fontFamily.heading }]}>
            Font Family
          </Text>
          <View style={styles.fontGrid}>
            {fontFamilyOptions.map((option) => {
              const isLocked = option.isPremium && !isPremium;
              const isSelected = fontFamily === option.key;
              
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleFontSelect(option.key, option.name, option.isPremium)}
                  style={[
                    styles.fontOption,
                    isLocked && styles.fontOptionLocked,
                    { 
                      backgroundColor: isSelected ? theme.primaryLight : theme.card,
                      borderColor: isSelected ? theme.primary : theme.border,
                      borderWidth: isSelected ? 2 : 1,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.fontOptionContent}>
                    <View style={styles.fontInfo}>
                      <Text style={[
                        styles.fontName, 
                        { 
                          color: theme.text, 
                          fontSize: theme.fonts.callout, 
                          fontFamily: option.fontPreviewFamily
                        }
                      ]}>
                        {option.name}
                      </Text>
                      <Text style={[styles.fontDescription, { color: theme.textSecondary, fontSize: theme.fonts.caption, fontFamily: theme.fontFamily.body }]}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && !isLocked && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    )}
                  </View>
                  
                  {/* Premium Badge */}
                  {option.isPremium && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="star" size={10} color="#000" />
                      <Text style={styles.premiumBadgeText}>PRO</Text>
                    </View>
                  )}
                  
                  {/* Lock Icon for non-premium users */}
                  {isLocked && (
                    <View style={styles.lockIcon}>
                      <Ionicons name="lock-closed" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Font Size Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: theme.fonts.title3, fontFamily: theme.fontFamily.heading }]}>
            Font Size
          </Text>
          <View style={styles.fontGrid}>
            {fontSizeOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                onPress={() => setFontSize(option.key)}
                style={[
                  styles.fontOption,
                  { 
                    backgroundColor: fontSize === option.key ? theme.primaryLight : theme.card,
                    borderColor: fontSize === option.key ? theme.primary : theme.border,
                    borderWidth: fontSize === option.key ? 2 : 1,
                  }
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.fontOptionContent}>
                  <View style={styles.fontInfo}>
                    <Text style={[styles.fontName, { color: theme.text, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
                      {option.name}
                    </Text>
                    <Text style={[styles.fontDescription, { color: theme.textSecondary, fontSize: theme.fonts.caption, fontFamily: theme.fontFamily.body }]}>
                      {option.description}
                    </Text>
                    <Text style={[
                      styles.sampleText,
                      {
                        fontSize: option.key === 'small' ? 14 : option.key === 'regular' ? 16 : 18,
                        color: theme.textSecondary,
                        fontFamily: theme.fontFamily.body,
                      }
                    ]}>
                      Sample text at {option.name.toLowerCase()} size
                    </Text>
                  </View>
                  {fontSize === option.key && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      
      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={paywallFeature}
      />
    </View>
  );
}