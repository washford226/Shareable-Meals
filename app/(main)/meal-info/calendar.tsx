import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import MealInfoDisplay, { MealData } from '../../../components/MealInfoDisplay';

export default function CalendarMealInfoPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { mealId, mealPlanId } = useLocalSearchParams<{ mealId: string; mealPlanId: string }>();
  
  const [meal, setMeal] = useState<MealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealPlanInfo, setMealPlanInfo] = useState<{date: string; mealType: string} | null>(null);

  useEffect(() => {
    fetchMealData();
  }, [mealId, mealPlanId]);

  const fetchMealData = async () => {
    try {
      if (!mealId || !mealPlanId) {
        Alert.alert("Error", "Meal ID or meal plan ID is missing.");
        router.back();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view meal details.");
        router.back();
        return;
      }

      // Fetch meal plan info first
      const { data: mealPlanData, error: mealPlanError } = await supabase
        .from('meal_plan')
        .select('date, meal_type')
        .eq('meal_plan_id', mealPlanId)
        .single();

      if (mealPlanError) throw mealPlanError;

      setMealPlanInfo({
        date: new Date(mealPlanData.date).toLocaleDateString(),
        mealType: mealPlanData.meal_type
      });

      // Fetch meal data with ingredients
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

  const handleRemoveFromCalendar = () => {
    Alert.alert(
      'Remove from Calendar',
      'Are you sure you want to remove this meal from your calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: removeFromCalendar },
      ]
    );
  };

  const removeFromCalendar = async () => {
    try {
      const { error } = await supabase
        .from('meal_plan')
        .delete()
        .eq('meal_plan_id', mealPlanId);

      if (error) throw error;

      Alert.alert('Success', 'Meal removed from calendar');
      router.back();
    } catch (error) {
      console.error('Error removing meal from calendar:', error);
      Alert.alert('Error', 'Failed to remove meal from calendar');
    }
  };

  const renderCalendarInfo = () => {
    if (!mealPlanInfo) return null;

    return (
      <View style={[styles.calendarInfo, { backgroundColor: theme.primary + '20' }]}>
        <Ionicons name="calendar" size={20} color={theme.primary} />
        <Text style={[styles.calendarText, { color: theme.primary }]}>
          Scheduled for {mealPlanInfo.mealType} on {mealPlanInfo.date}
        </Text>
      </View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.danger }]}
        onPress={handleRemoveFromCalendar}
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text style={styles.actionButtonText}>Remove from Calendar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <MealInfoDisplay
      meal={meal!}
      loading={loading}
      title="Calendar Meal"
      onBack={() => router.back()}
      onShare={() => {}}
      showAuthor={true}
      topOverlay={renderCalendarInfo()}
      customActions={!loading && meal ? renderActionButtons() : undefined}
    />
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  calendarInfo: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  calendarText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.heading,
  },
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
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
});