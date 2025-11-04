import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface MealData {
  id: string;
  name: string;
  description: string;
  image?: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  servings?: number;
  cook_time?: string;
  meal_type?: string;
  cuisine?: string;
  instructions?: string;
  created_at: string;
  like_count?: number;
  user_has_liked?: boolean;
  author: {
    name: string;
  };
  isBookmarked?: boolean;
  rating?: number;
  ratingCount?: number;
  saves?: number;
  datePublished?: string;
  ingredients?: { raw_name: string; quantity: number; unit: string }[];
  tags?: string[];
  visibility?: boolean;
  created_by_ai?: boolean;
  edamam_macros?: boolean;
}

interface MealInfoDisplayProps {
  meal: MealData;
  loading: boolean;
  title: string;
  onBack: () => void;
  onShare: () => void;
  onBookmarkToggle?: () => void;
  showBookmark?: boolean;
  showStats?: boolean;
  showAuthor?: boolean;
  customActions?: React.ReactNode;
  topOverlay?: React.ReactNode;
}

export default function MealInfoDisplay({
  meal,
  loading,
  title,
  onBack,
  onShare,
  onBookmarkToggle,
  showBookmark = false,
  showStats = false,
  showAuthor = true,
  customActions,
  topOverlay,
}: MealInfoDisplayProps) {
  const { theme } = useTheme();

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
    title: {
      fontSize: theme.fonts.large,
      fontFamily: theme.fontFamily.heading,
      fontWeight: 'bold',
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
    },
    imageContainer: {
      position: 'relative',
    },
    mealImage: {
      width: SCREEN_WIDTH,
      height: 250,
    },
    bookmarkButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsOverlay: {
      position: 'absolute',
      bottom: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statsText: {
      fontSize: theme.fonts.tiny,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
    },
    contentContainer: {
      padding: 20,
    },
    mealName: {
      fontSize: theme.fonts.largeTitle,
      fontFamily: theme.fontFamily.heading,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    mealDescription: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      lineHeight: 24,
      marginBottom: 20,
    },
    authorSection: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    authorAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    authorInfo: {
      flex: 1,
    },
    authorNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    authorName: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.heading,
      fontWeight: '600',
      marginBottom: 2,
    },
    publishDate: {
      fontSize: theme.fonts.small,
      fontFamily: theme.fontFamily.body,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24,
    },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    tagText: {
      fontSize: theme.fonts.tiny,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
    },
    nutritionSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: theme.fonts.large,
      fontFamily: theme.fontFamily.heading,
      fontWeight: '600',
      marginBottom: 16,
    },
    nutritionGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    nutritionCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    nutritionValue: {
      fontSize: theme.fonts.large,
      fontFamily: theme.fontFamily.heading,
      fontWeight: 'bold',
    },
    nutritionUnit: {
      fontSize: theme.fonts.tiny,
      fontFamily: theme.fontFamily.body,
      marginTop: 2,
    },
    nutritionLabel: {
      fontSize: theme.fonts.tiny,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
      marginTop: 4,
    },
    detailsSection: {
      marginBottom: 24,
    },
    detailsCard: {
      padding: 16,
      borderRadius: 12,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    detailLabel: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      marginLeft: 12,
      flex: 1,
    },
    detailValue: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
    },
    section: {
      marginBottom: 20,
    },
    instructionsContainer: {
      padding: 16,
      borderRadius: 12,
    },
    instructionsText: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      lineHeight: 24,
    },
    ingredientsContainer: {
      borderRadius: 12,
      padding: 4,
    },
    ingredientItem: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 4,
    },
    ingredientInfo: {
      flex: 1,
    },
    ingredientName: {
      fontSize: theme.fonts.medium,
      fontFamily: theme.fontFamily.body,
      fontWeight: '500',
      marginBottom: 2,
    },
    ingredientAmount: {
      fontSize: theme.fonts.small,
      fontFamily: theme.fontFamily.body,
    },
    aiBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginRight: 8,
      marginBottom: 6,
    },
    aiBadgeText: {
      color: theme.buttonTextPrimary || '#ffffff',
      fontSize: theme.fonts.tiny,
      fontFamily: theme.fontFamily.body,
      fontWeight: 'bold',
    },
    edamamBadge: {
      width: 60,
      height: 18,
      marginBottom: 6,
    },
  });

  const styles = createStyles(theme);

  const renderNutritionCard = (label: string, value: number, unit: string, color: string) => (
    <View style={[styles.nutritionCard, { backgroundColor: theme.card }]}>
      <Text style={[styles.nutritionValue, { color }]}>{value}</Text>
      <Text style={[styles.nutritionUnit, { color: theme.textSecondary }]}>{unit}</Text>
      <Text style={[styles.nutritionLabel, { color: theme.text }]}>{label}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>Failed to load meal</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <TouchableOpacity onPress={onShare}>
          <Ionicons name="share-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Meal Image */}
        {meal.image && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: meal.image }} 
              style={styles.mealImage}
              resizeMode="cover"
            />
            
            {/* Top Overlay (custom content) */}
            {topOverlay}
            
            {/* Bookmark Button */}
            {showBookmark && onBookmarkToggle && (
              <TouchableOpacity
                style={[styles.bookmarkButton, { backgroundColor: theme.card }]}
                onPress={onBookmarkToggle}
              >
                <Ionicons
                  name={meal.isBookmarked ? "bookmark" : "bookmark-outline"}
                  size={20}
                  color={meal.isBookmarked ? theme.primary : theme.text}
                />
              </TouchableOpacity>
            )}
            
            {/* Stats Overlay */}
            {showStats && (
              <View style={[styles.statsOverlay, { backgroundColor: theme.card }]}>
                <Ionicons 
                  name={meal.user_has_liked ? "heart" : "heart-outline"} 
                  size={16} 
                  color={meal.user_has_liked ? theme.danger : theme.text} 
                />
                <Text style={[styles.statsText, { color: theme.text }]}>
                  {meal.like_count || 0}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          <Text style={[styles.mealName, { color: theme.text }]}>
            {meal.name}
          </Text>
          
          {/* AI and Edamam Badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            {meal.created_by_ai && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>
                  AI Generated
                </Text>
              </View>
            )}
            {meal.edamam_macros && (
              <Image 
                source={require('../assets/images/Edamam_Badge_Transparent.png')}
                style={styles.edamamBadge}
                resizeMode="contain"
              />
            )}
          </View>
          
          <Text style={[styles.mealDescription, { color: theme.textSecondary }]}>
            {meal.description}
          </Text>

          {/* Author Info */}
          {showAuthor && (
            <View style={[styles.authorSection, { backgroundColor: theme.card }]}>
              <View style={styles.authorInfo}>
                <View style={styles.authorNameContainer}>
                  <Text style={[styles.authorName, { color: theme.text }]}>
                    {meal.author.name}
                  </Text>
                </View>
                <Text style={[styles.publishDate, { color: theme.subtext }]}>
                  {meal.datePublished || new Date(meal.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}

          {/* Tags */}
          {meal.tags && meal.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {meal.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.tagText, { color: theme.primary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Nutrition Facts */}
          <View style={styles.nutritionSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Nutrition Facts (per serving)
            </Text>
            <View style={styles.nutritionGrid}>
              {renderNutritionCard('Calories', meal.calories || 0, 'cal', theme.primary)}
              {renderNutritionCard('Protein', meal.protein || 0, 'g', theme.success)}
              {renderNutritionCard('Carbs', meal.carbohydrates || 0, 'g', theme.warning)}
              {renderNutritionCard('Fat', meal.fat || 0, 'g', theme.danger)}
            </View>
          </View>

          {/* Meal Details */}
          <View style={styles.detailsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Meal Details
            </Text>
            <View style={[styles.detailsCard, { backgroundColor: theme.card }]}>
              <View style={styles.detailRow}>
                <Ionicons name="people" size={20} color={theme.primary} />
                <Text style={[styles.detailLabel, { color: theme.text }]}>
                  Servings
                </Text>
                <Text style={[styles.detailValue, { color: theme.textSecondary }]}>
                  {meal.servings || 1}
                </Text>
              </View>
              {meal.cook_time && (
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={20} color={theme.primary} />
                  <Text style={[styles.detailLabel, { color: theme.text }]}>
                    Cook Time
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.textSecondary }]}>
                    {meal.cook_time}
                  </Text>
                </View>
              )}
              {meal.meal_type && (
                <View style={styles.detailRow}>
                  <Ionicons name="restaurant" size={20} color={theme.primary} />
                  <Text style={[styles.detailLabel, { color: theme.text }]}>
                    Meal Type
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.textSecondary }]}>
                    {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}
                  </Text>
                </View>
              )}
              {meal.cuisine && (
                <View style={styles.detailRow}>
                  <Ionicons name="globe-outline" size={20} color={theme.primary} />
                  <Text style={[styles.detailLabel, { color: theme.text }]}>
                    Cuisine
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.textSecondary }]}>
                    {meal.cuisine.charAt(0).toUpperCase() + meal.cuisine.slice(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Instructions Section */}
          {meal.instructions && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Instructions
              </Text>
              <View style={[styles.instructionsContainer, { backgroundColor: theme.card }]}>
                <Text style={[styles.instructionsText, { color: theme.text }]}>
                  {meal.instructions}
                </Text>
              </View>
            </View>
          )}

          {/* Ingredients Section */}
          {meal.ingredients && meal.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Ingredients ({meal.ingredients.length})
              </Text>
              <View style={[styles.ingredientsContainer, { backgroundColor: theme.card }]}>
                {meal.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.ingredientInfo}>
                      <Text style={[styles.ingredientName, { color: theme.text }]}>
                        {ingredient.raw_name}
                      </Text>
                      <Text style={[styles.ingredientAmount, { color: theme.textSecondary }]}>
                        {ingredient.quantity} {ingredient.unit}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Custom Actions */}
          {customActions}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}