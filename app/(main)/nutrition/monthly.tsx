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
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth,
  isToday,
  subMonths,
  addMonths,
  getDay
} from 'date-fns';
import { supabase } from '../../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DayNutrition {
  date: Date;
  calories: number;
  goalMet: boolean;
}

export default function MonthlyNutritionPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const [monthData, setMonthData] = useState<DayNutrition[]>([]);
  const dailyCalorieGoal = 2000;

  const fetchMonthData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view nutrition data.");
        return;
      }

      // Calculate date range for current month
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      // Fetch meal plan data from Supabase
      const { data: mealPlanData, error } = await supabase
        .from('meal_plan')
        .select(`
          date,
          meals!inner (
            calories
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
      const dailyTotals: { [key: string]: number } = {};
      
      if (mealPlanData && mealPlanData.length > 0) {
        mealPlanData.forEach((mealPlan) => {
          if (mealPlan.meals && !Array.isArray(mealPlan.meals)) {
            const mealData = mealPlan.meals as any;
            const dateKey = mealPlan.date;
            
            if (!dailyTotals[dateKey]) {
              dailyTotals[dateKey] = 0;
            }
            dailyTotals[dateKey] += mealData.calories || 0;
          }
        });
      }

      // Convert to DayNutrition format
      const monthDataArray = monthDays.map(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const calories = dailyTotals[dateKey] || 0;
        return {
          date,
          calories,
          goalMet: calories >= dailyCalorieGoal * 0.8, // Within 20% of goal
        };
      });

      setMonthData(monthDataArray);
    } catch (error) {
      console.error('Error fetching month nutrition data:', error);
      Alert.alert('Error', 'Failed to load monthly nutrition data');
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    fetchMonthData();
  }, [currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = direction === 'next' 
      ? addMonths(currentMonth, 1) 
      : subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
  };

  const monthStats = {
    totalDays: monthDays.length,
    daysWithData: monthData.length,
    goalsMetDays: monthData.filter(day => day.goalMet).length,
    averageCalories: Math.round(
      monthData.reduce((sum, day) => sum + day.calories, 0) / monthData.length
    ),
    bestStreak: 5, // Calculate actual streak in real app
    currentStreak: 3,
  };

  const getDayColor = (dayData: DayNutrition | undefined) => {
    if (!dayData) return theme.cardSecondary;
    if (dayData.goalMet) return theme.success;
    return theme.warning;
  };

  const renderCalendarDay = (date: Date, index: number) => {
    const dayData = monthData.find(d => format(d.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    const isCurrentDay = isToday(date);
    const dayOfWeek = getDay(date);
    
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.calendarDay,
          { backgroundColor: getDayColor(dayData) },
          isCurrentDay && { borderColor: theme.primary, borderWidth: 2 },
        ]}
        onPress={() => {
          // Navigate to specific day - for now just go to daily view
          router.push('./daily');
        }}
      >
        <Text
          style={[
            styles.dayNumber,
            { 
              color: dayData?.goalMet ? '#FFFFFF' : theme.text,
              fontWeight: isCurrentDay ? 'bold' : 'normal',
            },
          ]}
        >
          {format(date, 'd')}
        </Text>
        {dayData && (
          <Text
            style={[
              styles.dayCalories,
              { color: dayData.goalMet ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {dayData.calories}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string
  ) => (
    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.statTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statSubtitle, { color: theme.textSecondary }]}>
        {subtitle}
      </Text>
    </View>
  );

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading monthly nutrition data...
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
          Monthly Nutrition
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('prev')}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('next')}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: theme.text }]}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>Goal Met</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>Below Goal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.cardSecondary }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>No Data</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.calendarSection}>
          {/* Week day headers */}
          <View style={styles.weekHeader}>
            {weekDays.map(day => (
              <Text key={day} style={[styles.weekDay, { color: theme.textSecondary }]}>
                {day}
              </Text>
            ))}
          </View>
          
          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {monthDays.map((date, index) => renderCalendarDay(date, index))}
          </View>
        </View>

        {/* Monthly Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Month Summary
          </Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Success Rate',
              `${Math.round((monthStats.goalsMetDays / monthStats.totalDays) * 100)}%`,
              `${monthStats.goalsMetDays}/${monthStats.totalDays} days`,
              'checkmark-circle',
              theme.success
            )}
            {renderStatCard(
              'Average Calories',
              monthStats.averageCalories,
              'per day',
              'flame',
              theme.primary
            )}
            {renderStatCard(
              'Best Streak',
              `${monthStats.bestStreak} days`,
              'consecutive goals met',
              'trophy',
              theme.warning
            )}
            {renderStatCard(
              'Current Streak',
              `${monthStats.currentStreak} days`,
              'keep it going!',
              'trending-up',
              theme.primary
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Quick Actions
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.card }]}
            onPress={() => router.push('./weekly')}
          >
            <Ionicons name="stats-chart" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.text }]}>
              View Weekly Details
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.card }]}
            onPress={() => router.push('./daily')}
          >
            <Ionicons name="today" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.text }]}>
              Today's Nutrition
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
  settingsButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  monthNavButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
  },
  calendarSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    paddingVertical: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: (SCREEN_WIDTH - 40) / 7,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
  },
  dayCalories: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
    marginTop: 2,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 60) / 2,
    padding: 16,
    borderRadius: 12,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginLeft: 6,
  },
  statValue: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  actionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    marginLeft: 12,
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