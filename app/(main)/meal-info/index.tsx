import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Share,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import MealInfoDisplay, { MealData } from '../../../components/MealInfoDisplay';

export default function MealInfoIndex() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { mealId, context } = useLocalSearchParams<{ mealId: string; context: string }>();
  
  const [meal, setMeal] = useState<MealData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (context && mealId) {
      // Redirect to context-specific meal info page
      switch (context) {
        case 'calendar':
          router.replace(`/(main)/meal-info/calendar?mealId=${mealId}` as any);
          break;
        case 'my-meals':
          router.replace(`/(main)/meal-info/my-meals?mealId=${mealId}` as any);
          break;
        case 'discover':
          router.replace(`/(main)/meal-info/discover?mealId=${mealId}` as any);
          break;
        case 'competition':
          router.replace(`/(main)/meal-info/competition?mealId=${mealId}` as any);
          break;
        default:
          fetchMealData();
      }
    } else if (mealId) {
      fetchMealData();
    } else {
      Alert.alert("Error", "Meal ID is missing.");
      router.back();
    }
  }, [mealId, context]);

  const fetchMealData = async () => {
    try {
      if (!mealId) {
        Alert.alert("Error", "Meal ID is missing.");
        router.back();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view meal details.");
        router.back();
        return;
      }

      // Fetch meal data first
      const { data: mealData, error } = await supabase
        .from('meals')
        .select(`
          *,
          meal_picture_url,
          meal_ingredients (
            raw_name,
            quantity,
            unit
          )
        `)
        .eq('id', mealId)
        .single();

      if (error) throw error;

      if (!mealData) {
        Alert.alert("Error", "Meal not found.");
        router.back();
        return;
      }

      // Fetch user profile information separately
      let authorInfo = {
        name: mealData.user_id === user.id ? 'You' : 'Unknown User',
      };

      if (mealData.user_id && mealData.user_id !== user.id) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', mealData.user_id)
          .single();

        if (profileData) {
          authorInfo = {
            name: profileData.username || 'Unknown User',
          };
        }
      }

      // Transform data to match interface
      const transformedMeal: MealData = {
        id: mealData.id.toString(),
        name: mealData.name,
        description: mealData.description || '',
        calories: mealData.calories || 0,
        protein: mealData.protein || 0,
        carbohydrates: mealData.carbohydrates || 0,
        fat: mealData.fat || 0,
        servings: mealData.servings || 1,
        meal_type: mealData.meal_type,
        cuisine: mealData.cuisine,
        instructions: mealData.instructions,
        ingredients: mealData.meal_ingredients || [],
        created_at: mealData.created_at,
        image: mealData.meal_picture_url,
        cook_time: mealData.cook_time,
        created_by_ai: mealData.created_by_ai || false,
        edamam_macros: mealData["Edamam_macros"] || false,
        author: authorInfo,
        tags: [],
        datePublished: new Date(mealData.created_at).toLocaleDateString(),
      };

      setMeal(transformedMeal);
    } catch (error) {
      console.error('Error fetching meal:', error);
      Alert.alert("Error", "Failed to load meal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this meal: ${meal?.name}\n\n${meal?.description}`,
        title: meal?.name,
      });
    } catch (error) {
      console.error('Error sharing meal:', error);
    }
  };

  const handleCopyToMyMeals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !meal) return;

      const { error } = await supabase.from('meals').insert({
        name: `${meal.name} (Copy)`,
        description: meal.description,
        calories: meal.calories,
        protein: meal.protein,
        carbohydrates: meal.carbohydrates,
        fat: meal.fat,
        servings: meal.servings,
        meal_type: meal.meal_type,
        cuisine: meal.cuisine,
        instructions: meal.instructions,
        meal_picture_url: meal.image,
        cook_time: meal.cook_time,
        user_id: user.id,
        visibility: false,
      });

      if (error) throw error;

      Alert.alert('Success', 'Meal copied to your meals!');
    } catch (error) {
      console.error('Error copying meal:', error);
      Alert.alert('Error', 'Failed to copy meal');
    }
  };

  const handleAddToCalendar = () => {
    router.push(`/(main)/(tabs)/meal-plan/calendar?mealId=${mealId}` as any);
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.primary }]}
        onPress={handleCopyToMyMeals}
      >
        <Ionicons name="copy-outline" size={20} color="white" />
        <Text style={styles.actionButtonText}>Copy to My Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.success }]}
        onPress={handleAddToCalendar}
      >
        <Ionicons name="calendar-outline" size={20} color="white" />
        <Text style={styles.actionButtonText}>Add to Calendar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <MealInfoDisplay
      meal={meal!}
      loading={loading}
      title="Meal Details"
      onBack={() => router.back()}
      onShare={handleShare}
      showAuthor={true}
      customActions={!loading && meal ? renderActionButtons() : undefined}
    />
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  actionButtons: {
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontFamily: theme.fontFamily.semiBold,
    ...theme.fonts.subheadline,
  },
});