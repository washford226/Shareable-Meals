import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import MealInfoDisplay, { MealData } from '../../../components/MealInfoDisplay';

export default function MyMealsMealInfoPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  
  const [meal, setMeal] = useState<MealData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMealData();
  }, [mealId]);

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
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      if (!mealData) {
        Alert.alert("Error", "Meal not found.");
        router.back();
        return;
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
        visibility: mealData.visibility || false,
        image: mealData.meal_picture_url,
        cook_time: mealData.cook_time,
        created_by_ai: mealData.created_by_ai || false,
        edamam_macros: mealData["Edamam_macros"] || false,
        author: {
          name: 'You',
        },
        tags: [],
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

  const handleEdit = () => {
    router.push(`/(main)/create-meal/edit?mealId=${mealId}` as any);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteMeal },
      ]
    );
  };

  const deleteMeal = async () => {
    try {
      const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealId);

      if (error) throw error;

      Alert.alert('Success', 'Meal deleted successfully');
      router.back();
    } catch (error) {
      console.error('Error deleting meal:', error);
      Alert.alert('Error', 'Failed to delete meal');
    }
  };

  const toggleVisibility = async () => {
    try {
      const newVisibility = !meal?.visibility;
      const { error } = await supabase
        .from('meals')
        .update({ visibility: newVisibility })
        .eq('id', mealId);

      if (error) throw error;

      setMeal(prev => prev ? { ...prev, visibility: newVisibility } : null);
      Alert.alert(
        'Success',
        `Meal is now ${newVisibility ? 'public' : 'private'}`
      );
    } catch (error) {
      console.error('Error updating visibility:', error);
      Alert.alert('Error', 'Failed to update meal visibility');
    }
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.primary }]}
        onPress={handleEdit}
      >
        <Ionicons name="create-outline" size={20} color="white" />
        <Text style={styles.actionButtonText}>Edit</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { 
          backgroundColor: meal?.visibility ? theme.success : theme.textSecondary 
        }]}
        onPress={toggleVisibility}
      >
        <Ionicons 
          name={meal?.visibility ? "eye-outline" : "eye-off-outline"} 
          size={20} 
          color="white" 
        />
        <Text style={styles.actionButtonText}>
          {meal?.visibility ? 'Public' : 'Private'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.danger }]}
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text style={styles.actionButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <MealInfoDisplay
      meal={meal!}
      loading={loading}
      title="My Meal"
      onBack={() => router.back()}
      onShare={handleShare}
      showAuthor={false}
      customActions={!loading && meal ? renderActionButtons() : undefined}
    />
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
});