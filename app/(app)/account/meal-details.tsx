import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface MealDetails {
  id: number;
  name: string;
  description: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  instructions?: string;
  recipeLink?: string;
  created_by_ai: boolean;
  created_by?: string;
  favorite: boolean;
  dietary_restrictions?: string;
  servings?: number;
  cuisine?: string;
  picture?: string;
  visibility: boolean;
  forever_invis: boolean;
  created_at: string;
  user_id: string;
  creator_username?: string;
}

interface MealIngredient {
  meal_ingredient_id: number;
  meal_id: number;
  raw_name?: string;
  quantity?: number;
  unit?: string;
  food_id?: number;
}

const AdminMealDetailsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { mealId, reportId } = useLocalSearchParams<{ mealId: string; reportId: string }>();
  const [meal, setMeal] = useState<MealDetails | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mealId) {
      fetchMealDetails();
    }
  }, [mealId]);

  const fetchMealDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('meals')
        .select(`
          *
        `)
        .eq('id', parseInt(mealId))
        .single();

      if (error) {
        console.error('Error fetching meal details:', error);
        Alert.alert('Error', 'Failed to fetch meal details');
        return;
      }

      // Get username from user_profiles using the user_id
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', data.user_id)
        .single();

      // Get meal ingredients
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('meal_ingredients')
        .select('*')
        .eq('meal_id', parseInt(mealId));

      if (ingredientsError) {
        console.error('Error fetching ingredients:', ingredientsError);
        // Don't fail completely if ingredients can't be fetched
      }

      const mealWithCreator = {
        ...data,
        creator_username: userProfile?.username || 'Unknown User',
      };

      setMeal(mealWithCreator);
      setIngredients(ingredientsData || []);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleHideMeal = async () => {
    Alert.alert(
      'Hide Meal',
      'Are you sure you want to hide this meal? This action will make it permanently invisible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide Meal',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('meals')
                .update({ forever_invis: true })
                .eq('id', parseInt(mealId));

              if (error) {
                console.error('Error hiding meal:', error);
                Alert.alert('Error', 'Failed to hide meal');
                return;
              }

              // Update local state
              if (meal) {
                setMeal({ ...meal, forever_invis: true });
              }

              Alert.alert('Success', 'Meal has been hidden');
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          },
        },
      ]
    );
  };

  const handleResolveReport = async () => {
    if (!reportId) return;
    
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'Resolved' })
        .eq('report_id', parseInt(reportId));

      if (error) {
        console.error('Error resolving report:', error);
        Alert.alert('Error', 'Failed to resolve report');
        return;
      }

      Alert.alert('Success', 'Report has been resolved', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleDismissReport = async () => {
    if (!reportId) return;
    
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'Dismissed' })
        .eq('report_id', parseInt(reportId));

      if (error) {
        console.error('Error dismissing report:', error);
        Alert.alert('Error', 'Failed to dismiss report');
        return;
      }

      Alert.alert('Success', 'Report has been dismissed', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal details...</Text>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>Meal not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Meal Review</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Meal Status Indicators */}
        <View style={styles.statusContainer}>
          {meal.forever_invis && (
            <View style={[styles.statusBadge, { backgroundColor: theme.danger }]}>
              <Text style={styles.statusBadgeText}>HIDDEN</Text>
            </View>
          )}
          {!meal.visibility && (
            <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
              <Text style={styles.statusBadgeText}>PRIVATE</Text>
            </View>
          )}
        </View>

        {/* Meal Image */}
        {meal.picture && (
          <Image source={{ uri: meal.picture }} style={styles.mealImage} />
        )}

        {/* Basic Info */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
          <Text style={[styles.creatorInfo, { color: theme.subtext }]}>
            Created by: {meal.creator_username}
          </Text>
          <Text style={[styles.creatorInfo, { color: theme.subtext }]}>
            Created: {new Date(meal.created_at).toLocaleDateString()}
          </Text>
          {meal.created_by_ai && (
            <Text style={[styles.aiTag, { color: theme.primary }]}>Generated by AI</Text>
          )}
        </View>

        {/* Description */}
        {meal.description && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
            <Text style={[styles.description, { color: theme.text }]}>{meal.description}</Text>
          </View>
        )}

        {/* Nutrition Info */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition Information</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Calories</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>{meal.calories || 'N/A'}</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Protein</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>{meal.protein || 'N/A'}g</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Carbs</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>{meal.carbohydrates || 'N/A'}g</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Fat</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>{meal.fat || 'N/A'}g</Text>
            </View>
          </View>
        </View>

        {/* Additional Info */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Additional Information</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>Servings: {meal.servings || 1}</Text>
          {meal.cuisine && (
            <Text style={[styles.infoText, { color: theme.text }]}>Cuisine: {meal.cuisine}</Text>
          )}
          {meal.dietary_restrictions && (
            <Text style={[styles.infoText, { color: theme.text }]}>Dietary: {meal.dietary_restrictions}</Text>
          )}
        </View>

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
            {ingredients.map((ingredient, index) => (
              <View key={ingredient.meal_ingredient_id} style={styles.ingredientItem}>
                <Text style={[styles.ingredientText, { color: theme.text }]}>
                  {ingredient.quantity && ingredient.unit 
                    ? `${ingredient.quantity} ${ingredient.unit} `
                    : ingredient.quantity 
                    ? `${ingredient.quantity} `
                    : ''
                  }
                  {ingredient.raw_name || `Food ID: ${ingredient.food_id}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        {meal.instructions && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
            <Text style={[styles.instructions, { color: theme.text }]}>{meal.instructions}</Text>
          </View>
        )}

        {/* Recipe Link */}
        {meal.recipeLink && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recipe Link</Text>
            <Text style={[styles.link, { color: theme.primary }]}>{meal.recipeLink}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.danger }]}
          onPress={handleHideMeal}
          disabled={meal.forever_invis}
        >
          <Text style={styles.actionButtonText}>
            {meal.forever_invis ? 'Already Hidden' : 'Hide Meal'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.warning }]}
          onPress={handleDismissReport}
        >
          <Text style={styles.actionButtonText}>Dismiss Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={handleResolveReport}
        >
          <Text style={styles.actionButtonText}>Resolve Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mealImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  section: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  mealName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  creatorInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  aiTag: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '48%',
    marginBottom: 12,
  },
  nutritionLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
  },
  ingredientItem: {
    marginBottom: 8,
  },
  ingredientText: {
    fontSize: 16,
    lineHeight: 22,
  },
  instructions: {
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default AdminMealDetailsScreen;
