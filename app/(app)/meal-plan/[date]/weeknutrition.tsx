import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import NutritionNav from "../../../../components/nutritionNav";
import { format, subDays } from "date-fns";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const { width: screenWidth } = Dimensions.get('window');

type MacroKey = "calories" | "protein" | "carbs" | "fat";

const WeekNutritionScreen = () => {
  const { date } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  // Define macros with icons and theme-based colors
  const macros = [
    { label: "Calories", key: "calories" as MacroKey, icon: "🔥", unit: "kcal" },
    { label: "Protein", key: "protein" as MacroKey, icon: "🥩", unit: "g" },
    { label: "Carbs", key: "carbs" as MacroKey, icon: "🍞", unit: "g" },
    { label: "Fat", key: "fat" as MacroKey, icon: "🥑", unit: "g" },
  ];

  const getMacroColor = (macroKey: MacroKey) => {
    switch (macroKey) {
      case 'protein': return theme.protein || "#dc2626";
      case 'carbs': return theme.carbs || "#2563eb";
      case 'fat': return theme.fat || "#ca8a04";
      case 'calories': return theme.primary || "#3b82f6";
      default: return theme.primary || "#3b82f6";
    }
  };

  const [macroGoals, setMacroGoals] = useState({
    calories: 2000,
    protein: 100,
    carbs: 200,
    fat: 70,
  });
  const [weekData, setWeekData] = useState<
    { date: string; calories: number; protein: number; carbs: number; fat: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the last 7 days including the current date
  const getLast7Dates = () => {
    const baseDate = date ? new Date(date as string) : new Date();
    return Array.from({ length: 7 }).map((_, i) =>
      format(subDays(baseDate, 6 - i), "yyyy-MM-dd")
    );
  };

  // Fetch user goals from Supabase
  const fetchUserGoals = async (retryCount = 0): Promise<boolean> => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Authentication error:", userError.message);
        setError("Authentication error. Please log in again.");
        return false;
      }
      
      if (!userData?.user) {
        setError("You are not logged in. Please log in to view nutrition data.");
        return false;
      }
      
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("calories_goal, protein_goal, carbohydrates_goal, fat_goal")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user goals:", error.message);
        
        // Retry logic for network errors
        if (retryCount < 2 && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log(`Retrying fetchUserGoals, attempt ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchUserGoals(retryCount + 1);
        }
        
        setError("Failed to load nutrition goals. Using default values.");
        return false;
      }

      if (data) {
        setMacroGoals({
          calories: data.calories_goal ?? 2000,
          protein: data.protein_goal ?? 100,
          carbs: data.carbohydrates_goal ?? 200,
          fat: data.fat_goal ?? 70,
        });
        return true;
      }
      
      setError("No nutrition goals found. Using default values.");
      return false;
    } catch (error) {
      console.error("Unexpected error fetching user goals:", error);
      
      // Retry logic for unexpected errors
      if (retryCount < 2) {
        console.log(`Retrying fetchUserGoals, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUserGoals(retryCount + 1);
      }
      
      setError("An unexpected error occurred loading nutrition goals.");
      return false;
    }
  };

  // Fetch macros for each day in the week from Supabase
  const fetchWeekData = async (retryCount = 0): Promise<boolean> => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Authentication error:", userError.message);
        setError("Authentication error. Please log in again.");
        return false;
      }
      
      if (!userData?.user) {
        setError("You are not logged in. Please log in to view nutrition data.");
        return false;
      }
      
      const userId = userData.user.id;
      const dates = getLast7Dates();

      // For each date, fetch both meal plan data and macro meals data
      const results = await Promise.all(
        dates.map(async (d) => {
          try {
            // Fetch both data sources in parallel
            const [mealPlanResponse, macroMealsResponse] = await Promise.all([
              supabase
                .from("meal_plan")
                .select(`
                  meals (
                    calories,
                    protein,
                    carbohydrates,
                    fat
                  )
                `)
                .eq("user_id", userId)
                .eq("date", d),
              
              supabase
                .from("macro_meals")
                .select("calories, protein, carbs, fat")
                .eq("user_id", userId)
                .gte("created_at", `${d}T00:00:00.000Z`)
                .lt("created_at", `${d}T23:59:59.999Z`)
            ]);

            if (mealPlanResponse.error) {
              console.error(`Error fetching meal plan data for ${d}:`, mealPlanResponse.error.message);
            }

            if (macroMealsResponse.error) {
              console.error(`Error fetching macro meals data for ${d}:`, macroMealsResponse.error.message);
            }

            // Calculate totals from meal plan data
            const mealPlanTotals = (mealPlanResponse.data || []).reduce(
              (acc, entry) => {
                // Handle the case where meal might be an array or a single object
                const meal = Array.isArray(entry.meals) ? entry.meals[0] : entry.meals;
                if (meal && typeof meal === 'object') {
                  return {
                    calories: acc.calories + (meal.calories || 0),
                    protein: acc.protein + (meal.protein || 0),
                    carbs: acc.carbs + (meal.carbohydrates || 0),
                    fat: acc.fat + (meal.fat || 0),
                  };
                }
                return acc;
              },
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );

            // Calculate totals from macro meals data (AI-scanned meals)
            const macroMealsTotals = (macroMealsResponse.data || []).reduce(
              (acc, macroMeal) => {
                return {
                  calories: acc.calories + (macroMeal.calories || 0),
                  protein: acc.protein + (macroMeal.protein || 0),
                  carbs: acc.carbs + (macroMeal.carbs || 0), // Note: macro_meals uses 'carbs' not 'carbohydrates'
                  fat: acc.fat + (macroMeal.fat || 0),
                };
              },
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );

            // Combine totals from both sources
            const combinedTotals = {
              calories: mealPlanTotals.calories + macroMealsTotals.calories,
              protein: mealPlanTotals.protein + macroMealsTotals.protein,
              carbs: mealPlanTotals.carbs + macroMealsTotals.carbs,
              fat: mealPlanTotals.fat + macroMealsTotals.fat,
            };

            return { date: d, ...combinedTotals };
          } catch (dayError) {
            console.error(`Unexpected error fetching data for ${d}:`, dayError);
            return { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 };
          }
        })
      );
      
      console.log("Weekly nutrition data (including AI-scanned meals):", results);
      setWeekData(results);
      return true;
    } catch (error) {
      console.error("Error fetching week data:", error);
      
      // Retry logic for network errors
      if (retryCount < 2) {
        console.log(`Retrying fetchWeekData, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchWeekData(retryCount + 1);
      }
      
      setError("Failed to load weekly nutrition data.");
      return false;
    }
  };

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      await Promise.all([fetchUserGoals(), fetchWeekData()]);
    } catch (error) {
      console.error("Error during refresh:", error);
      setError("An unexpected error occurred during refresh.");
    } finally {
      setRefreshing(false);
    }
  };

  // Load data function
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([fetchUserGoals(), fetchWeekData()]);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load weekly nutrition data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Calculate averages for each macro
  const averages = macros.reduce((acc, macro) => {
    const sum = weekData.reduce((total, day) => total + day[macro.key], 0);
    acc[macro.key] = weekData.length ? Math.round(sum / weekData.length) : 0;
    return acc;
  }, {} as Record<MacroKey, number>);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading weekly nutrition data...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {/* Back Button Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { backgroundColor: theme.card }]}
          onPress={() => router.push("/(app)/meal-plan/calendar")}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Week Nutrition
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={{ paddingTop: 10 }}>
        <NutritionNav />

        {/* Enhanced Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { 
            backgroundColor: theme.dangerLight, 
            borderColor: theme.danger,
            borderWidth: 1,
          }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, marginRight: 8, color: theme.danger }}>⚠️</Text>
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.danger }]}
              onPress={handleRefresh}
            >
              <Text style={[styles.retryButtonText, { color: theme.buttonTextPrimary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={[styles.title, { color: theme.text }]}>
            📊 Weekly Nutrition
          </Text>
          <Text style={[{ fontSize: 16, color: theme.textSecondary, textAlign: 'center' }]}>
            7-day nutrition overview and trends
          </Text>
          <Text style={[{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 4, fontStyle: 'italic' }]}>
            Includes planned meals and AI-scanned meals
          </Text>
        </View>

      {/* Weekly Chart Overview */}
      <View style={[styles.chartContainer, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>
          📈 Weekly Progress Chart
        </Text>
        <View style={styles.chartWrapper}>
          <View style={styles.customChart}>
            {weekData.map((day, dayIndex) => {
              const calPercent = macroGoals.calories ? (day.calories / macroGoals.calories) * 100 : 0;
              const heightPercent = Math.min(calPercent, 120); // Cap at 120% for visual purposes
              
              return (
                <View key={day.date} style={styles.chartBar}>
                  <View style={styles.chartBarContainer}>
                    <View 
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: getMacroColor('calories'),
                          opacity: 0.7 + (dayIndex * 0.04), // Varying opacity
                        }
                      ]}
                    />
                  </View>
                  <View style={styles.chartBarLabel}>
                    <Text style={[styles.chartBarText, { color: theme.textSecondary }]}>
                      {format(new Date(day.date), "EEE")}
                    </Text>
                    <Text style={[styles.chartBarValue, { color: theme.text }]}>
                      {Math.round(day.calories)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
          Daily calorie intake over the week
        </Text>
      </View>

      {/* Enhanced Averages Block */}
      <View style={[styles.averagesContainer, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.averagesTitle, { color: theme.text }]}>
          📊 Weekly Averages
        </Text>
        <View style={styles.averagesGrid}>
          {macros.map((macro) => {
            const value = averages[macro.key];
            const goal = macroGoals[macro.key];
            const percent = Math.round((value / goal) * 100);
            const isOver = value > goal;

            return (
              <View key={macro.key} style={[styles.averageCard, { 
                backgroundColor: theme.cardSecondary,
                borderColor: getMacroColor(macro.key),
              }]}>
                <Text style={styles.averageIcon}>{macro.icon}</Text>
                <Text style={[styles.averageLabel, { color: theme.text }]}>
                  {macro.label}
                </Text>
                <Text style={[styles.averageValue, { color: getMacroColor(macro.key) }]}>
                  {value}
                </Text>
                <Text style={[styles.averageGoal, { color: theme.textSecondary }]}>
                  / {goal} {macro.unit}
                </Text>
                <Text style={[styles.averagePercent, { 
                  color: isOver ? theme.danger : getMacroColor(macro.key) 
                }]}>
                  {percent}%
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Enhanced Daily Blocks */}
      {[...weekData].reverse().map((day) => (
        <View key={day.date} style={[styles.dayCard, { 
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        }]}>
          <View style={styles.dayHeader}>
            <Text style={[styles.dayLabel, { color: theme.text }]}>
              {format(new Date(day.date), "EEEE, MMMM d")}
            </Text>
            <Text style={[styles.dayCalories, { color: theme.primary }]}>
              {day.calories} kcal
            </Text>
          </View>
          
          <View style={styles.macrosRow}>
            {macros.slice(1).map((macro) => { // Skip calories as it's shown in header
              const value = day[macro.key];
              const goal = macroGoals[macro.key];
              const percent = Math.round((value / goal) * 100);

              return (
                <View key={macro.key} style={styles.macroItem}>
                  <Text style={styles.macroItemIcon}>{macro.icon}</Text>
                  <Text style={[styles.macroItemValue, { color: getMacroColor(macro.key) }]}>
                    {value}g
                  </Text>
                  <Text style={[styles.macroItemPercent, { color: theme.textSecondary }]}>
                    {percent}%
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Progress bar for overall day completion */}
          <View style={styles.dayProgress}>
            <Text style={[styles.dayProgressLabel, { color: theme.textSecondary }]}>
              Daily Goal Progress
            </Text>
            <View style={[styles.dayProgressBar, { backgroundColor: theme.divider }]}>
              <View style={[styles.dayProgressFill, {
                width: `${Math.min((day.calories / macroGoals.calories) * 100, 100)}%`,
                backgroundColor: theme.primary,
              }]} />
            </View>
            <Text style={[styles.dayProgressText, { color: theme.textSecondary }]}>
              {Math.round((day.calories / macroGoals.calories) * 100)}% of calorie goal
            </Text>
          </View>
        </View>
      ))}
      
      {/* Edamam Attribution */}
      <View style={styles.attributionContainer}>
        <Image 
          source={require("../../../../assets/images/Edamam_Badge_Transparent.png")}
          style={styles.attributionBadge}
          resizeMode="contain"
        />
        <Text style={[styles.attributionText, { color: theme.textSecondary }]}>
          Nutrition data powered by Edamam
        </Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.backButton, { 
          backgroundColor: theme.primary,
          shadowColor: theme.shadow,
        }]} 
        onPress={() => router.push("/(app)/meal-plan/calendar")}
        activeOpacity={0.8}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonTextPrimary }]}>
          ← Back to Calendar
        </Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "stretch",
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  backButton: {
    alignSelf: "center",
    marginTop: 32,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    minWidth: 200,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  chartContainer: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  chartWrapper: {
    position: 'relative',
  },
  customChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    paddingVertical: 10,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarContainer: {
    height: 100,
    width: 30,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 8,
    minHeight: 2,
  },
  chartBarLabel: {
    alignItems: 'center',
    marginTop: 8,
  },
  chartBarText: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 2,
  },
  chartBarValue: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  chart: {
    height: 160,
    width: screenWidth - 80,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingHorizontal: 10,
  },
  chartLabel: {
    alignItems: 'center',
    flex: 1,
  },
  chartLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  averagesContainer: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  averagesTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  averagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  averageCard: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  averageIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  averageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  averageValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  averageGoal: {
    fontSize: 12,
    marginBottom: 4,
  },
  averagePercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  dayCalories: {
    fontSize: 20,
    fontWeight: "800",
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroItemIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  macroItemValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  macroItemPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayProgress: {
    marginTop: 8,
  },
  dayProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  dayProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dayProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  dayProgressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  // Legacy styles (can be removed after migration)
  averagesBlock: {
    backgroundColor: "#e6eaf0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  averageText: {
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  dayBlock: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  macroText: {
    fontSize: 15,
    marginBottom: 4,
    fontWeight: "500",
  },
  progressBarBackground: {
    width: "100%",
    height: 16,
    backgroundColor: "#eee",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  progressBarOverrun: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    opacity: 0.3,
  },
  attributionContainer: {
    alignItems: 'center',
    marginVertical: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attributionBadge: {
    width: 120,
    height: 40,
    marginBottom: 8,
  },
  attributionText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44, // Account for status bar
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerBackButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40, // Match back button width for centering
  },
});

export default WeekNutritionScreen;