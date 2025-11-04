import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useRevenueCat } from '../../../context/RevenueCatContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { router } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import { getResponsiveFontSize } from '../../../utils/responsiveUtils';
import { Paywall } from '../../../components/Paywall';

interface Meal {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  picture?: string;
  planned_date?: string;
  meal_plan_id?: string;
  is_scanned?: boolean; // New field to distinguish scanned meals
}

interface DayMeals {
  [key: string]: Meal[];
}

interface NutritionSummary {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

interface NutritionGoals {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_WIDTH = SCREEN_WIDTH / 7;

export default function CalendarPage() {
  const { theme } = useTheme();
  const { isPremium } = useRevenueCat();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Calculate tab bar height for proper content padding
  const tabBarHeight = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10) + (Platform.OS === 'ios' ? 65 : 60);

  // Animated Meal Card Component
  const AnimatedMealCard = ({ meal, onPress }: { meal: Meal; onPress: () => void }) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={[
          styles.mealItem, 
          { backgroundColor: theme.card },
          meal.is_scanned && { borderLeftWidth: 4, borderLeftColor: '#00D4AA' }
        ]}>
          <TouchableOpacity
            style={styles.mealContent}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
          >
            {(meal.is_scanned || meal.picture) && (
              <View style={[styles.mealImageContainer, { marginRight: 16 }]}>
                {meal.is_scanned ? (
                  <View style={[styles.scannedMealIcon, { backgroundColor: '#00D4AA' }]}>
                    <Ionicons name="scan" size={24} color="white" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: meal.picture }}
                    style={styles.mealImage}
                    resizeMode="cover"
                  />
                )}
              </View>
            )}
            <View style={[styles.mealTextContainer, { marginLeft: (meal.is_scanned || meal.picture) ? 0 : 0 }]}>
              <View style={styles.mealNameContainer}>
                <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>
                  {meal.name}
                </Text>
                {meal.is_scanned && (
                  <View style={[styles.scannedBadge, { backgroundColor: '#00D4AA' }]}>
                    <Text style={styles.scannedBadgeText}>AI</Text>
                  </View>
                )}
              </View>
              <View style={styles.mealTypeContainer}>
                <Text style={[styles.mealTypeText, { color: meal.is_scanned ? '#00D4AA' : theme.primary }]}>
                  {meal.is_scanned ? 'Scanned' : meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}
                </Text>
              </View>
              <Text style={[styles.mealMacros, { color: theme.textSecondary }]} numberOfLines={1}>
                {meal.calories || 0} cal • P: {meal.protein || 0}g • C: {meal.carbohydrates || 0}g • F: {meal.fat || 0}g
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const [meals, setMeals] = useState<DayMeals>({});
  const [loading, setLoading] = useState(true);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>({
    calories: 2000,
    protein: 80,
    carbohydrates: 300,
    fat: 60,
  });

  const weekStart = startOfWeek(currentWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchMeals = useCallback(async () => {
    try {
      console.log('Starting fetchMeals...');
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        Alert.alert("Error", "You must be logged in to view your meal plan.");
        return;
      }

      // Calculate date range for current week (use current values, not dependencies)
      const currentWeekStart = startOfWeek(currentWeek);
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      console.log('Fetching meals for date range:', startDate, 'to', endDate);

      // Fetch meal plan data from Supabase
      const { data: mealPlanData, error: mealPlanError } = await supabase
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
            fat,
            meal_picture_url
          )
        `)
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('meal_type', { ascending: true });

      if (mealPlanError) {
        console.error('Supabase meal plan error:', mealPlanError);
        throw mealPlanError;
      }

      // Fetch scanned meals data from macro_meals table
      const { data: scannedMealsData, error: scannedMealsError } = await supabase
        .from('macro_meals')
        .select('*')
        .eq('user_id', user.id)
        .gte('meal_date', startDate)
        .lte('meal_date', endDate)
        .order('meal_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (scannedMealsError) {
        console.error('Supabase scanned meals error:', scannedMealsError);
        throw scannedMealsError;
      }

      console.log('Received meal plan data:', mealPlanData?.length || 0, 'entries');
      console.log('Received scanned meals data:', scannedMealsData?.length || 0, 'entries');

      // Transform data to DayMeals format
      const transformedMeals: DayMeals = {};
      
      // Process planned meals
      if (mealPlanData && mealPlanData.length > 0) {
        mealPlanData.forEach((mealPlan) => {
          const dateKey = mealPlan.date;
          if (!transformedMeals[dateKey]) {
            transformedMeals[dateKey] = [];
          }
          
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
              picture: mealData.meal_picture_url,
              planned_date: mealPlan.date,
              meal_plan_id: mealPlan.meal_plan_id.toString(),
              is_scanned: false,
            };
            
            transformedMeals[dateKey].push(meal);
          }
        });
      }

      // Process scanned meals
      if (scannedMealsData && scannedMealsData.length > 0) {
        scannedMealsData.forEach((scannedMeal) => {
          const dateKey = scannedMeal.meal_date;
          if (!transformedMeals[dateKey]) {
            transformedMeals[dateKey] = [];
          }
          
          const meal: Meal = {
            id: `scanned_${scannedMeal.id}`,
            name: scannedMeal.meal_name || 'Scanned Meal',
            meal_type: 'snack', // Default to snack for scanned meals, could be enhanced later
            calories: scannedMeal.calories || 0,
            protein: scannedMeal.protein || 0,
            carbohydrates: scannedMeal.carbs || 0,
            fat: scannedMeal.fat || 0,
            picture: undefined, // Scanned meals don't have pictures stored
            planned_date: scannedMeal.meal_date,
            is_scanned: true,
          };
          
          transformedMeals[dateKey].push(meal);
        });
      }

      console.log('Transformed meals:', Object.keys(transformedMeals).length, 'days with meals');
      // Set meals even if empty (this prevents the loading loop)
      setMeals(transformedMeals);
    } catch (error) {
      console.error('Error fetching meal plan:', error);
      Alert.alert('Error', 'Failed to load meal plan');
      // Set empty meals on error to stop loading loop
      setMeals({});
    } finally {
      // Always set loading to false
      console.log('Setting loading to false');
      setLoading(false);
    }
  }, []); // Remove weekStart dependency to prevent infinite loops

  // Single effect that runs on initial load and week changes
  useEffect(() => {
    fetchMeals();
  }, [currentWeek]); // Only currentWeek as dependency

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  }, [fetchMeals]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
  };

  const getDayMeals = (date: Date): Meal[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return meals[dateKey] || [];
  };

  const getTotalCalories = (dayMeals: Meal[]): number => {
    return dayMeals.reduce((total, meal) => total + (meal.calories || 0), 0);
  };

  const getNutritionSummary = (dayMeals: Meal[]): NutritionSummary => {
    return dayMeals.reduce(
      (summary, meal) => ({
        calories: summary.calories + (meal.calories || 0),
        protein: summary.protein + (meal.protein || 0),
        carbohydrates: summary.carbohydrates + (meal.carbohydrates || 0),
        fat: summary.fat + (meal.fat || 0),
      }),
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
    );
  };

  const renderDayCard = (date: Date) => {
    const dayMeals = getDayMeals(date);
    const totalCalories = getTotalCalories(dayMeals);
    const isSelected = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);

    return (
      <TouchableOpacity
        key={format(date, 'yyyy-MM-dd')}
        style={[
          styles.dayCard,
          { backgroundColor: theme.card },
          isSelected && { backgroundColor: theme.primary },
          isCurrentDay && !isSelected && { borderColor: theme.primary, borderWidth: 2 },
        ]}
        onPress={() => setSelectedDate(date)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.dayName,
            { color: isSelected ? theme.buttonTextPrimary : theme.textSecondary },
          ]}
        >
          {format(date, 'EEE')}
        </Text>
        <Text
          style={[
            styles.dayNumber,
            { color: isSelected ? theme.buttonTextPrimary : theme.text },
            isCurrentDay && !isSelected && { color: theme.primary },
          ]}
        >
          {format(date, 'd')}
        </Text>
        {dayMeals.length > 0 && (
          <View style={styles.mealIndicator}>
            <Text
              style={[
                styles.mealCount,
                { color: isSelected ? theme.buttonTextPrimary : theme.textSecondary },
              ]}
            >
              {dayMeals.length} meals
            </Text>
            {totalCalories > 0 && (
              <Text
                style={[
                  styles.calorieCount,
                  { color: isSelected ? theme.buttonTextPrimary : theme.textSecondary },
                ]}
              >
                {totalCalories} cal
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderNutritionChart = () => {
    const dayMeals = getDayMeals(selectedDate);
    const nutrition = getNutritionSummary(dayMeals);
    
    const getPercentage = (actual: number, goal: number): number => {
      return Math.min((actual / goal) * 100, 100);
    };

    const NutritionBar = ({ 
      label, 
      value, 
      goal, 
      color 
    }: { 
      label: string; 
      value: number; 
      goal: number; 
      color: string; 
    }) => {
      const percentage = getPercentage(value, goal);
      return (
        <View style={styles.nutritionBarContainer}>
          <View style={styles.nutritionBarHeader}>
            <Text style={[styles.nutritionLabel, { color: theme.text }]}>
              {label}
            </Text>
            <Text style={[styles.nutritionValue, { color: theme.textSecondary }]}>
              {Math.round(value)}g / {goal}g
            </Text>
          </View>
          <View style={[styles.nutritionBarTrack, { backgroundColor: theme.cardSecondary }]}>
            <View 
              style={[
                styles.nutritionBarFill, 
                { backgroundColor: color, width: `${percentage}%` }
              ]} 
            />
          </View>
        </View>
      );
    };

    return (
      <View style={[styles.nutritionChart, { backgroundColor: theme.card }]}>
        <View style={styles.nutritionHeader}>
          <Ionicons name="bar-chart" size={20} color={theme.primary} />
          <Text style={[styles.nutritionTitle, { color: theme.text }]}>
            Nutrition Summary
          </Text>
        </View>
        
        {/* Calories */}
        <View style={styles.caloriesContainer}>
          <Text style={[styles.caloriesLabel, { color: theme.textSecondary }]}>
            Calories
          </Text>
          <Text style={[styles.caloriesValue, { color: theme.text }]}>
            {nutrition.calories} / {nutritionGoals.calories}
          </Text>
          <View style={[styles.caloriesBar, { backgroundColor: theme.cardSecondary }]}>
            <View 
              style={[
                styles.caloriesBarFill, 
                { 
                  backgroundColor: theme.primary,
                  width: `${getPercentage(nutrition.calories, nutritionGoals.calories)}%` 
                }
              ]} 
            />
          </View>
        </View>

        {/* Macros */}
        <View style={styles.macrosContainer}>
          <NutritionBar 
            label="Protein" 
            value={nutrition.protein} 
            goal={nutritionGoals.protein} 
            color="#ff6b6b" 
          />
          <NutritionBar 
            label="Carbs" 
            value={nutrition.carbohydrates} 
            goal={nutritionGoals.carbohydrates} 
            color="#4ecdc4" 
          />
          <NutritionBar 
            label="Fat" 
            value={nutrition.fat} 
            goal={nutritionGoals.fat} 
            color="#ffe66d" 
          />
        </View>
      </View>
    );
  };

  const renderSelectedDayMeals = () => {
    const dayMeals = getDayMeals(selectedDate);

    if (dayMeals.length === 0) {
      return (
        <View style={styles.emptyMeals}>
          <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No meals planned for {format(selectedDate, 'MMMM d')}
          </Text>
          <TouchableOpacity
            style={[styles.addMealButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              const dateString = format(selectedDate, 'yyyy-MM-dd');
              router.push(`/(main)/add-to-calendar?date=${dateString}` as any);
            }}
          >
            <Ionicons name="add" size={16} color={theme.buttonTextPrimary} />
            <Text style={[styles.addMealText, { color: theme.buttonTextPrimary }]}>
              Add Meal
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.mealsContainer}>
        {dayMeals.map((meal) => (
          <AnimatedMealCard
            key={meal.id}
            meal={meal}
            onPress={() => {
              if (meal.is_scanned) {
                // For scanned meals, we could navigate to a different detail page
                // or show an alert with the nutrition info for now
                Alert.alert(
                  'Scanned Meal Details',
                  `${meal.name}\n\nCalories: ${meal.calories || 0}\nProtein: ${meal.protein || 0}g\nCarbs: ${meal.carbohydrates || 0}g\nFat: ${meal.fat || 0}g`,
                  [{ text: 'OK', style: 'default' }]
                );
              } else {
                router.push(`../meal-info/calendar?mealId=${meal.id}&mealPlanId=${meal.meal_plan_id}` as any);
              }
            }}
          />
        ))}
        <TouchableOpacity
          style={[styles.addMealButton, { backgroundColor: theme.cardSecondary }]}
          onPress={() => {
            const dateString = format(selectedDate, 'yyyy-MM-dd');
            router.push(`/(main)/add-to-calendar?date=${dateString}` as any);
          }}
        >
          <Ionicons name="add" size={16} color={theme.primary} />
          <Text style={[styles.addMealText, { color: theme.primary }]}>
            Add Another Meal
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    console.log('Rendering loading screen...');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading meal plan...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log('Rendering calendar with', Object.keys(meals).length, 'days of meals');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: theme.text }]}>
              Calendar
            </Text>
            <Text style={[styles.monthYear, { color: theme.textSecondary }]}>
              {format(currentWeek, 'MMMM yyyy')}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.cardSecondary }]}
              onPress={() => {
                router.push('../nutrition/daily');
              }}
            >
              <Ionicons name="stats-chart" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (!isPremium) {
                  setShowPaywall(true);
                } else {
                  router.push('../ai/meal-scanner');
                }
              }}
            >
              <Ionicons name="scan" size={20} color={theme.buttonTextPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Week Navigation */}
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateWeek('prev')}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.weekRange, { color: theme.text }]}>
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
          </Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateWeek('next')}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Week View */}
        <View style={styles.weekContainer}>
          {weekDays.map(renderDayCard)}
        </View>

        {/* Selected Day Details */}
        <ScrollView 
          style={styles.selectedDayContainer}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.selectedDayTitle, { color: theme.text }]}>
            {format(selectedDate, 'EEEE, MMMM d')}
          </Text>
          
          {/* Meals List */}
          {renderSelectedDayMeals()}
          
          {/* Nutrition Summary - Below Meals */}
          {getDayMeals(selectedDate).length > 0 && renderNutritionChart()}
        </ScrollView>
      </ScrollView>

      {/* Paywall Modal */}
      <Paywall 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)}
        feature="AI Meal Scanner"
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.fonts.title1,
    fontFamily: theme.fontFamily.heading,
    fontWeight: 'bold',
  },
  monthYear: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginTop: 4,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  weekRange: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    fontWeight: '500',
  },
  weekContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 3,
    borderRadius: 12,
    minHeight: 85,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  dayName: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
    fontWeight: '500',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    marginBottom: 4,
  },
  mealIndicator: {
    alignItems: 'center',
  },
  mealCount: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  calorieCount: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  selectedDayContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectedDayTitle: {
    fontSize: theme.fonts.title2,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  emptyMeals: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.body,
    marginTop: 12,
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.65,
    lineHeight: 24,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  addMealText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  mealsContainer: {
    gap: 12,
  },
  mealItem: {
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    position: 'relative',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTypeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealType: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
    fontWeight: '500',
  },
  mealCalories: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
  },
  mealName: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  // New nutrition chart styles
  nutritionChart: {
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  nutritionTitle: {
    fontSize: theme.fonts.title3,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '700',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  caloriesContainer: {
    marginBottom: 16,
  },
  caloriesLabel: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
    marginBottom: 4,
  },
  caloriesValue: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '700',
    marginBottom: 8,
  },
  caloriesBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  caloriesBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macrosContainer: {
    gap: 18,
    marginTop: 4,
  },
  nutritionBarContainer: {
    marginBottom: 16,
  },
  nutritionBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nutritionLabel: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  nutritionValue: {
    fontSize: theme.fonts.footnote,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  nutritionBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  nutritionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  // New meal item styles with images
  mealContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mealImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mealImage: {
    width: '100%',
    height: '100%',
  },
  mealTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  mealDetails: {
    flex: 1,
  },
  mealMacros: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
    marginTop: 4,
  },
  mealTypeContainer: {
    marginVertical: 2,
  },
  mealTypeText: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
  },
  macroText: {
    fontSize: theme.fonts.footnote,
    fontFamily: theme.fontFamily.body,
  },
  // New styles for scanned meals
  scannedMealIcon: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  mealNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scannedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  scannedBadgeText: {
    color: 'white',
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
    fontWeight: '700',
  },
});