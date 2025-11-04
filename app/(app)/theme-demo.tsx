/**
 * Theme Demonstration Screen
 * Shows off the enhanced theme system with ChoresQuest-inspired colors and dynamic styling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { createDynamicStyles, createMealStyles, getMealTypeColor, addTransparency } from '../../utils/styleHelpers';

export default function ThemeDemoScreen() {
  const { theme, themeVariant, setThemeVariant, availableThemes } = useTheme();
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  
  // Create dynamic styles using our new system
  const dynamicStyles = createDynamicStyles(theme);
  const mealStyles = createMealStyles({
    ...theme,
    mealColors: theme.mealColors || {},
    mealAccent: theme.mealAccent || {},
  });

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
  const macroData = [
    { name: 'Calories', value: 450, icon: 'flash', color: theme.primary },
    { name: 'Protein', value: '25g', icon: 'barbell', color: theme.success },
    { name: 'Carbs', value: '45g', icon: 'leaf', color: theme.warning },
    { name: 'Fat', value: '18g', icon: 'water', color: '#FFD700' },
  ];

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>
            Enhanced Theme System
          </Text>
          <Text style={dynamicStyles.caption}>
            Powered by ChoresQuest-inspired design
          </Text>
        </View>

        {/* Theme Switcher */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Theme Selection
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {availableThemes.map((themeName) => (
              <TouchableOpacity
                key={themeName}
                style={[
                  dynamicStyles.secondaryButton,
                  {
                    marginRight: 12,
                    backgroundColor: themeVariant === themeName ? theme.primary : theme.backgroundSecondary,
                    borderColor: themeVariant === themeName ? theme.primary : theme.border,
                  }
                ]}
                onPress={() => setThemeVariant(themeName)}
              >
                <Text style={[
                  dynamicStyles.secondaryButtonText,
                  {
                    color: themeVariant === themeName ? theme.buttonTextPrimary : theme.text,
                    textTransform: 'capitalize',
                  }
                ]}>
                  {themeName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Color Palette Showcase */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Color Palette
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[
              { name: 'Primary', color: theme.primary },
              { name: 'Success', color: theme.success },
              { name: 'Warning', color: theme.warning },
              { name: 'Danger', color: theme.danger },
              { name: 'Info', color: theme.info },
              { name: 'Background', color: theme.background },
              { name: 'Card', color: theme.backgroundCard },
              { name: 'Text', color: theme.text },
            ].map((colorItem) => (
              <View key={colorItem.name} style={{ width: '25%', padding: 4 }}>
                <View
                  style={{
                    backgroundColor: colorItem.color,
                    height: 40,
                    borderRadius: 8,
                    marginBottom: 4,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                />
                <Text style={[dynamicStyles.footnote, { textAlign: 'center' }]}>
                  {colorItem.name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Button Styles */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Button Styles
          </Text>
          
          <TouchableOpacity style={dynamicStyles.primaryButton}>
            <Text style={dynamicStyles.primaryButtonText}>Primary Button</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[dynamicStyles.secondaryButton, { marginTop: 12 }]}>
            <Text style={dynamicStyles.secondaryButtonText}>Secondary Button</Text>
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View style={dynamicStyles.successBadge}>
              <Text style={dynamicStyles.successText}>Success</Text>
            </View>
            <View style={[dynamicStyles.warningBadge, { marginLeft: 8 }]}>
              <Text style={dynamicStyles.warningText}>Warning</Text>
            </View>
            <View style={[dynamicStyles.dangerBadge, { marginLeft: 8 }]}>
              <Text style={dynamicStyles.dangerText}>Danger</Text>
            </View>
          </View>
        </View>

        {/* Card Examples */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Card Layouts
          </Text>
          
          <View style={dynamicStyles.card}>
            <Text style={dynamicStyles.body}>
              This is a primary card using the enhanced theme system. It automatically adapts to the selected theme with proper shadows, colors, and typography.
            </Text>
          </View>
          
          <View style={dynamicStyles.cardSecondary}>
            <Text style={dynamicStyles.caption}>
              Secondary card style with different background and padding.
            </Text>
          </View>
        </View>

        {/* Meal Type Badges */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Meal Type Badges
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {mealTypes.map((mealType) => (
              <TouchableOpacity
                key={mealType}
                style={[
                  mealStyles.mealTypeBadge,
                  {
                    backgroundColor: getMealTypeColor(mealType, theme),
                    marginRight: 8,
                    marginBottom: 8,
                  }
                ]}
                onPress={() => setSelectedMealType(mealType)}
              >
                <Text style={mealStyles.mealTypeText}>
                  {mealType}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Macro Display */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Nutrition Macros
          </Text>
          <View style={dynamicStyles.card}>
            <View style={mealStyles.macroRow}>
              {macroData.map((macro) => (
                <View key={macro.name} style={mealStyles.macroItem}>
                  <Ionicons name={macro.icon as any} size={16} color={macro.color} />
                  <Text style={mealStyles.macroText}>
                    {macro.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Typography Scale */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Typography Scale
          </Text>
          <View style={dynamicStyles.card}>
            <Text style={dynamicStyles.title}>Title Text</Text>
            <Text style={dynamicStyles.subtitle}>Subtitle Text</Text>
            <Text style={dynamicStyles.body}>Body text for longer content and descriptions.</Text>
            <Text style={dynamicStyles.caption}>Caption text for secondary information.</Text>
            <Text style={dynamicStyles.footnote}>Footnote text for small details.</Text>
          </View>
        </View>

        {/* Interactive Elements */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={[dynamicStyles.subtitle, { marginBottom: 16 }]}>
            Interactive Elements
          </Text>
          
          <View style={dynamicStyles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={dynamicStyles.iconContainer}>
                  <Ionicons name="restaurant" size={20} color={theme.primary} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={dynamicStyles.body}>Sample Meal</Text>
                  <Text style={dynamicStyles.caption}>with enhanced styling</Text>
                </View>
              </View>
              
              <TouchableOpacity>
                <Ionicons name="heart-outline" size={24} color={theme.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={[dynamicStyles.card, { marginHorizontal: 20, marginBottom: 40 }]}>
          <Text style={[dynamicStyles.body, { textAlign: 'center' }]}>
            🎨 Enhanced Theme System
          </Text>
          <Text style={[dynamicStyles.caption, { textAlign: 'center', marginTop: 8 }]}>
            Featuring 7 beautiful themes with comprehensive color palettes, 
            dynamic styling, and consistent design language across the entire app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Any additional static styles if needed
});