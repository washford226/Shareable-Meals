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
import { format, startOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import { supabase } from '../../../utils/supabase';
import { getResponsiveFontSize } from '../../../utils/responsiveUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DayData {
  date: Date;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function WeeklyNutritionPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const [weekData, setWeekData] = useState<DayData[]>([]);

  const dailyGoals = {
    calories: 2000,
    protein: 120,
    carbs: 250,
    fat: 75,
  };

  const fetchWeekData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view nutrition data.");
        return;
      }

      // Calculate date range for current week
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      // Fetch meal plan data from Supabase
      const { data: mealPlanData, error } = await supabase
        .from('meal_plan')
        .select(`
          date,
          meals!inner (
            calories,
            protein,
            carbohydrates,
            fat
          )
        `)
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Group by date and calculate daily totals
      const dailyTotals: { [key: string]: DayData } = {};
      
      // Initialize all days with zero values
      weekDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        dailyTotals[dateKey] = {
          date: day,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        };
      });

      // Add meal data
      if (mealPlanData && mealPlanData.length > 0) {
        mealPlanData.forEach((mealPlan) => {
          if (mealPlan.meals && !Array.isArray(mealPlan.meals)) {
            const mealData = mealPlan.meals as any;
            const dateKey = mealPlan.date;
            
            if (dailyTotals[dateKey]) {
              dailyTotals[dateKey].calories += mealData.calories || 0;
              dailyTotals[dateKey].protein += mealData.protein || 0;
              dailyTotals[dateKey].carbs += mealData.carbohydrates || 0;
              dailyTotals[dateKey].fat += mealData.fat || 0;
            }
          }
        });
      }

      // Convert to array
      const weekDataArray = Object.values(dailyTotals);
      setWeekData(weekDataArray);
    } catch (error) {
      console.error('Error fetching week nutrition data:', error);
      Alert.alert('Error', 'Failed to load weekly nutrition data');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchWeekData();
  }, [currentWeek]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'next' 
      ? addWeeks(currentWeek, 1) 
      : subWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);
  };

  const weekAverages = {
    calories: Math.round(weekData.reduce((sum, day) => sum + day.calories, 0) / 7),
    protein: Math.round(weekData.reduce((sum, day) => sum + day.protein, 0) / 7),
    carbs: Math.round(weekData.reduce((sum, day) => sum + day.carbs, 0) / 7),
    fat: Math.round(weekData.reduce((sum, day) => sum + day.fat, 0) / 7),
  };

  const getProgressColor = (current: number, goal: number) => {
    const percentage = (current / goal) * 100;
    if (percentage >= 90) return theme.success;
    if (percentage >= 70) return theme.warning;
    return theme.primary;
  };

  const renderDayCard = (dayData: DayData, index: number) => {
    const isToday = format(dayData.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.dayCard,
          { backgroundColor: theme.card },
          isToday && { borderColor: theme.primary, borderWidth: 2 },
        ]}
        onPress={() => router.push('./daily')}
      >
        <View style={styles.dayHeader}>
          <Text style={[styles.dayName, { color: theme.text }]}>
            {format(dayData.date, 'EEE')}
          </Text>
          <Text style={[styles.dayDate, { color: theme.textSecondary }]}>
            {format(dayData.date, 'd')}
          </Text>
        </View>
        
        <View style={styles.dayNutrition}>
          <View style={styles.caloriesRow}>
            <Text style={[styles.caloriesText, { color: theme.primary }]}>
              {dayData.calories}
            </Text>
            <Text style={[styles.caloriesLabel, { color: theme.textSecondary }]}>
              kcal
            </Text>
          </View>
          
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: theme.text }]}>
                {dayData.protein}g
              </Text>
              <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>
                P
              </Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: theme.text }]}>
                {dayData.carbs}g
              </Text>
              <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>
                C
              </Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: theme.text }]}>
                {dayData.fat}g
              </Text>
              <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>
                F
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAverageCard = (
    title: string,
    current: number,
    goal: number,
    unit: string,
    icon: keyof typeof Ionicons.glyphMap
  ) => {
    const percentage = (current / goal) * 100;
    const progressColor = getProgressColor(current, goal);

    return (
      <View style={[styles.averageCard, { backgroundColor: theme.card }]}>
        <View style={styles.averageHeader}>
          <Ionicons name={icon} size={18} color={progressColor} />
          <Text style={[styles.averageTitle, { color: theme.text }]}>{title}</Text>
        </View>
        <Text style={[styles.averageValue, { color: theme.text }]}>
          {current}{unit}
        </Text>
        <Text style={[styles.averageGoal, { color: theme.textSecondary }]}>
          Goal: {goal}{unit}
        </Text>
        <View style={[styles.averageProgress, { backgroundColor: theme.cardSecondary }]}>
          <View
            style={[
              styles.averageProgressFill,
              { backgroundColor: progressColor, width: `${Math.min(percentage, 100)}%` },
            ]}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading weekly nutrition data...
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
          Weekly Nutrition
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateWeek('prev')}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateWeek('next')}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Week Navigation */}
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.weekTitle, { color: theme.text }]}>
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </Text>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Days Grid */}
        <View style={styles.daysSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Daily Breakdown
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.daysContainer}>
              {weekData.map((dayData, index) => renderDayCard(dayData, index))}
            </View>
          </ScrollView>
        </View>

        {/* Week Averages */}
        <View style={styles.averagesSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Week Averages
          </Text>
          <View style={styles.averagesGrid}>
            {renderAverageCard(
              'Calories',
              weekAverages.calories,
              dailyGoals.calories,
              '',
              'flame'
            )}
            {renderAverageCard(
              'Protein',
              weekAverages.protein,
              dailyGoals.protein,
              'g',
              'fitness'
            )}
            {renderAverageCard(
              'Carbs',
              weekAverages.carbs,
              dailyGoals.carbs,
              'g',
              'leaf'
            )}
            {renderAverageCard(
              'Fat',
              weekAverages.fat,
              dailyGoals.fat,
              'g',
              'water'
            )}
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Week Summary
          </Text>
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={20} color={theme.success} />
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Days on track
              </Text>
              <Text style={[styles.statValue, { color: theme.success }]}>
                5/7
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trending-up" size={20} color={theme.primary} />
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Best day
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                Wednesday
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="star" size={20} color={theme.warning} />
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Consistency
              </Text>
              <Text style={[styles.statValue, { color: theme.warning }]}>
                85%
              </Text>
            </View>
          </View>
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
    fontWeight: '600',
  },
  calendarButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  weekNavButton: {
    padding: 8,
  },
  weekTitle: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '600',
  },
  daysSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  daysContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  dayCard: {
    width: 80,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dayHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
    fontWeight: '500',
  },
  dayDate: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    marginTop: 2,
  },
  dayNutrition: {
    alignItems: 'center',
    width: '100%',
  },
  caloriesRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  caloriesText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
  },
  caloriesLabel: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  macrosRow: {
    width: '100%',
    gap: 4,
  },
  macroItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroValue: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
    fontWeight: '500',
  },
  macroLabel: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  averagesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  averagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  averageCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 60) / 2,
    padding: 16,
    borderRadius: 12,
  },
  averageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  averageTitle: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    fontWeight: '500',
    marginLeft: 6,
  },
  averageValue: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  averageGoal: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
    marginBottom: 8,
  },
  averageProgress: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  averageProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginLeft: 12,
    flex: 1,
  },
  statValue: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
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
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
});