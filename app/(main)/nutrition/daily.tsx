import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format, addDays, subDays } from 'date-fns';
import { supabase } from '../../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DailyGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Meal {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
}

export default function DailyNutritionPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [nutrition, setNutrition] = useState<NutritionData>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [goals] = useState<DailyGoals>({
    calories: 2000,
    protein: 120,
    carbs: 250,
    fat: 75,
  });

  const fetchDayMeals = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view nutrition data.");
        return;
      }

      // Format date for query
      const dateString = format(selectedDate, 'yyyy-MM-dd');

      // Fetch meal plan data from Supabase
      const { data: mealPlanData, error } = await supabase
        .from('meal_plan')
        .select(`
          meal_plan_id,
          date,
          meal_type,
          meal_id,
          meals!inner (
            id,
            name,
            calories,
            protein,
            carbohydrates,
            fat
          )
        `)
        .eq('user_id', user.id)
        .eq('date', dateString)
        .order('meal_type', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Transform data to Meal format
      const transformedMeals: Meal[] = [];
      let totalNutrition: NutritionData = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      
      if (mealPlanData && mealPlanData.length > 0) {
        mealPlanData.forEach((mealPlan) => {
          if (mealPlan.meals && !Array.isArray(mealPlan.meals)) {
            const mealData = mealPlan.meals as any;
            const meal: Meal = {
              id: mealData.id.toString(),
              name: mealData.name,
              meal_type: mealPlan.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
              calories: mealData.calories || 0,
              protein: mealData.protein || 0,
              carbohydrates: mealData.carbohydrates || 0,
              fat: mealData.fat || 0,
            };
            
            transformedMeals.push(meal);
            
            // Add to nutrition totals
            totalNutrition.calories += meal.calories || 0;
            totalNutrition.protein += meal.protein || 0;
            totalNutrition.carbs += meal.carbohydrates || 0;
            totalNutrition.fat += meal.fat || 0;
          }
        });
      }

      setMeals(transformedMeals);
      setNutrition(totalNutrition);
    } catch (error) {
      console.error('Error fetching meal plan:', error);
      Alert.alert('Error', 'Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDayMeals();
  }, [selectedDate]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' 
      ? addDays(selectedDate, 1) 
      : subDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  const getProgressPercentage = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return theme.success;
    if (percentage >= 70) return theme.warning;
    return theme.primary;
  };

  const renderMacroCard = (
    title: string,
    current: number,
    goal: number,
    unit: string,
    icon: keyof typeof Ionicons.glyphMap
  ) => {
    const percentage = getProgressPercentage(current, goal);
    const progressColor = getProgressColor(percentage);

    return (
      <View style={[styles.macroCard, { backgroundColor: theme.card }]}>
        <View style={styles.macroHeader}>
          <Ionicons name={icon} size={20} color={progressColor} />
          <Text style={[styles.macroTitle, { color: theme.text }]}>{title}</Text>
        </View>
        <View style={styles.macroProgress}>
          <View style={[styles.progressBar, { backgroundColor: theme.cardSecondary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: progressColor, width: `${percentage}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.macroValues}>
          <Text style={[styles.currentValue, { color: theme.text }]}>
            {current}{unit}
          </Text>
          <Text style={[styles.goalValue, { color: theme.textSecondary }]}>
            / {goal}{unit}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading nutrition data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          Daily Nutrition
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('prev')}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('next')}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date */}
        <View style={styles.dateSection}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>

        {/* Calories Summary */}
        <View style={[styles.caloriesCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.caloriesTitle, { color: theme.text }]}>
            Daily Calories
          </Text>
          <View style={styles.caloriesContent}>
            <View style={styles.caloriesLeft}>
              <Text style={[styles.caloriesNumber, { color: theme.primary }]}>
                {nutrition.calories}
              </Text>
              <Text style={[styles.caloriesLabel, { color: theme.textSecondary }]}>
                consumed
              </Text>
            </View>
            <View style={styles.caloriesCenter}>
              <View style={[styles.caloriesProgress, { backgroundColor: theme.cardSecondary }]}>
                <View
                  style={[
                    styles.caloriesProgressFill,
                    { 
                      backgroundColor: theme.primary,
                      width: `${getProgressPercentage(nutrition.calories, goals.calories)}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.caloriesRight}>
              <Text style={[styles.caloriesRemaining, { color: theme.text }]}>
                {goals.calories - nutrition.calories}
              </Text>
              <Text style={[styles.caloriesLabel, { color: theme.textSecondary }]}>
                remaining
              </Text>
            </View>
          </View>
        </View>

        {/* Macros */}
        <View style={styles.macrosSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Macronutrients
          </Text>
          <View style={styles.macrosGrid}>
            {renderMacroCard('Protein', nutrition.protein, goals.protein, 'g', 'fitness')}
            {renderMacroCard('Carbs', nutrition.carbs, goals.carbs, 'g', 'leaf')}
            {renderMacroCard('Fat', nutrition.fat, goals.fat, 'g', 'water')}
          </View>
        </View>

        {/* Meals for the Day */}
        <View style={styles.macrosSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Meals for {format(selectedDate, 'MMMM d')}
          </Text>
          {meals.length > 0 ? (
            <View style={styles.mealsGrid}>
              {meals.map((meal) => (
                <View key={meal.id} style={[styles.mealItem, { backgroundColor: theme.card }]}>
                  <View style={styles.mealHeader}>
                    <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
                    <Text style={[styles.mealType, { color: theme.primary }]}>
                      {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}
                    </Text>
                  </View>
                  <Text style={[styles.mealCalories, { color: theme.textSecondary }]}>
                    {meal.calories || 0} cal • P: {meal.protein || 0}g • C: {meal.carbohydrates || 0}g • F: {meal.fat || 0}g
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyMeals}>
              <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No meals planned for this day
              </Text>
            </View>
          )}
        </View>

        {/* Navigation */}
        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.card }]}
            onPress={() => router.push('./weekly')}
          >
            <Ionicons name="stats-chart" size={20} color={theme.primary} />
            <Text style={[styles.navButtonText, { color: theme.text }]}>
              Weekly View
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.card }]}
            onPress={() => router.push('./monthly')}
          >
            <Ionicons name="calendar" size={20} color={theme.primary} />
            <Text style={[styles.navButtonText, { color: theme.text }]}>
              Monthly View
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  calendarButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  dateSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  dateText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
  },
  caloriesCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
  },
  caloriesTitle: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 16,
    textAlign: 'center',
  },
  caloriesContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caloriesLeft: {
    alignItems: 'center',
    flex: 1,
  },
  caloriesCenter: {
    flex: 2,
    paddingHorizontal: 16,
  },
  caloriesRight: {
    alignItems: 'center',
    flex: 1,
  },
  caloriesNumber: {
    fontSize: theme.fonts.largeTitle,
    fontFamily: theme.fontFamily.heading,
  },
  caloriesRemaining: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
  },
  caloriesLabel: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginTop: 4,
  },
  caloriesProgress: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  caloriesProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  macrosSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 16,
  },
  macrosGrid: {
    gap: 12,
  },
  macroCard: {
    padding: 16,
    borderRadius: 12,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroTitle: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginLeft: 8,
  },
  macroProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentValue: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  goalValue: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginLeft: 2,
  },
  otherNutrients: {
    gap: 8,
  },
  nutrientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  nutrientLabel: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginLeft: 8,
    flex: 1,
  },
  nutrientValue: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
  },
  navigationSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  mealsGrid: {
    gap: 12,
  },
  mealItem: {
    padding: 16,
    borderRadius: 12,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealName: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    flex: 1,
  },
  mealType: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.heading,
    textTransform: 'capitalize',
  },
  mealCalories: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
  },
  emptyMeals: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    marginTop: 12,
    textAlign: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  navButtonText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    marginLeft: 12,
    flex: 1,
  },
});