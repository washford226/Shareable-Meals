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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import NutritionNav from "../../../../components/nutritionNav";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const { width: screenWidth } = Dimensions.get('window');

type MacroKey = "calories" | "protein" | "carbs" | "fat";

const macros: { label: string; key: MacroKey }[] = [
  { label: "Calories", key: "calories" },
  { label: "Protein", key: "protein" },
  { label: "Carbs", key: "carbs" },
  { label: "Fat", key: "fat" },
];

const NutritionScreen = () => {
  const { date } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [macroGoals, setMacroGoals] = useState({
    calories: 2000,
    protein: 100,
    carbs: 200,
    fat: 70,
  });
  const [actualMacros, setActualMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [macroError, setMacroError] = useState<string | null>(null);

  // Helper function to format date
  const formatDate = (dateString: string | string[]) => {
    try {
      const dateStr = Array.isArray(dateString) ? dateString[0] : dateString;
      return format(new Date(dateStr), "EEEE, MMMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  // Fetch user goals from Supabase
  const fetchUserGoals = async (retryCount = 0): Promise<boolean> => {
    try {
      setGoalError(null);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Authentication error:", userError.message);
        setGoalError("Authentication error. Please log in again.");
        return false;
      }
      
      if (!userData?.user) {
        setGoalError("You are not logged in. Please log in to view your nutrition goals.");
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
        
        setGoalError("Failed to load nutrition goals. Using default values.");
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
      
      setGoalError("No nutrition goals found. Using default values.");
      return false;
    } catch (error) {
      console.error("Unexpected error fetching user goals:", error);
      
      // Retry logic for unexpected errors
      if (retryCount < 2) {
        console.log(`Retrying fetchUserGoals, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUserGoals(retryCount + 1);
      }
      
      setGoalError("An unexpected error occurred loading nutrition goals.");
      return false;
    }
  };

  // Fetch actual macros for the day from Supabase
  const fetchDayMacros = async (retryCount = 0): Promise<boolean> => {
    try {
      setMacroError(null);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Authentication error:", userError.message);
        setMacroError("Authentication error. Please log in again.");
        return false;
      }
      
      if (!userData?.user) {
        setMacroError("You are not logged in. Please log in to view nutrition data.");
        return false;
      }
      
      const userId = userData.user.id;

      // Validate date parameter
      if (!date || typeof date !== 'string') {
        setMacroError("Invalid date provided.");
        return false;
      }

      // Fetch both meal plan data and macro meals data for this date
      const [mealPlanResponse, macroMealsResponse] = await Promise.all([
        // Get all meals for this user and date from meal_plan, join meals table for macros
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
          .eq("date", date),
        
        // Get macro meals for this date (AI-scanned meals)
        supabase
          .from("macro_meals")
          .select("calories, protein, carbs, fat")
          .eq("user_id", userId)
          .gte("created_at", `${date}T00:00:00.000Z`)
          .lt("created_at", `${date}T23:59:59.999Z`)
      ]);

      if (mealPlanResponse.error) {
        console.error("Error fetching meal plan data:", mealPlanResponse.error.message);
        
        // Retry logic for network errors
        if (retryCount < 2 && (mealPlanResponse.error.message.includes('network') || mealPlanResponse.error.message.includes('timeout'))) {
          console.log(`Retrying fetchDayMacros, attempt ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchDayMacros(retryCount + 1);
        }
        
        setMacroError(`Failed to load nutrition data for ${formatDate(date)}.`);
        return false;
      }

      if (macroMealsResponse.error) {
        console.error("Error fetching macro meals data:", macroMealsResponse.error.message);
        // Don't fail completely if macro meals fail, just log the error
        console.warn("Continuing without macro meals data due to error:", macroMealsResponse.error.message);
      }

      // Sum up macros from meal plan data
      const mealPlanTotals = (mealPlanResponse.data || []).reduce(
        (acc, entry) => {
          const meal = entry.meals;
          // Handle both single object and array responses
          const mealData = Array.isArray(meal) ? meal[0] : meal;
          
          if (mealData && typeof mealData === 'object') {
            return {
              calories: acc.calories + (mealData.calories || 0),
              protein: acc.protein + (mealData.protein || 0),
              carbs: acc.carbs + (mealData.carbohydrates || 0),
              fat: acc.fat + (mealData.fat || 0),
            };
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      // Sum up macros from macro meals data (AI-scanned meals)
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
      
      console.log(`Nutrition data for ${date}:`, {
        mealPlan: mealPlanTotals,
        macroMeals: macroMealsTotals,
        combined: combinedTotals
      });
      
      setActualMacros(combinedTotals);
      return true;
    } catch (error) {
      console.error("Unexpected error fetching day macros:", error);
      
      // Retry logic for unexpected errors
      if (retryCount < 2) {
        console.log(`Retrying fetchDayMacros, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchDayMacros(retryCount + 1);
      }
      
      setMacroError("An unexpected error occurred loading nutrition data.");
      return false;
    }
  };

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setGoalError(null);
    setMacroError(null);
    
    try {
      const [goalsSuccess, macrosSuccess] = await Promise.all([
        fetchUserGoals(),
        fetchDayMacros()
      ]);
      
      if (!goalsSuccess && !macrosSuccess) {
        setError("Failed to load nutrition data. Please check your connection and try again.");
      } else if (!goalsSuccess) {
        setError("Failed to load nutrition goals. Using default values.");
      } else if (!macrosSuccess) {
        setError("Failed to load meal data for this day.");
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  // Load data function
  const loadData = async () => {
    setLoading(true);
    setError(null);
    setGoalError(null);
    setMacroError(null);
    
    try {
      const [goalsSuccess, macrosSuccess] = await Promise.all([
        fetchUserGoals(),
        fetchDayMacros()
      ]);
      
      if (!goalsSuccess && !macrosSuccess) {
        setError("Failed to load nutrition data. Please check your connection and try again.");
      } else if (!goalsSuccess) {
        setError("Failed to load nutrition goals. Using default values.");
      } else if (!macrosSuccess) {
        setError("Failed to load meal data for this day.");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (date) {
      loadData();
    } else {
      setError("No date provided.");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading nutrition data...
        </Text>
      </View>
    );
  }

  // Helper function to get color based on ratio
  const getProgressColor = (ratio: number, macroKey: MacroKey) => {
    // Use macro-specific colors from theme when available
    if (macroKey === 'protein') return theme.protein || "#dc2626";
    if (macroKey === 'carbs') return theme.carbs || "#2563eb";
    if (macroKey === 'fat') return theme.fat || "#ca8a04";
    
    // Fallback to general progress colors for calories
    if (ratio < 0.5) return theme.success || "#22c55e";
    if (ratio < 0.8) return theme.warning || "#f59e0b";
    if (ratio <= 1) return theme.primary || "#3b82f6";
    return theme.danger || "#ef4444";
  };

  const getMacroIcon = (macroKey: MacroKey) => {
    switch (macroKey) {
      case 'calories': return '🔥';
      case 'protein': return '🥩';
      case 'carbs': return '🍞';
      case 'fat': return '🥑';
      default: return '📊';
    }
  };

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
      <NutritionNav />
      
      {/* Enhanced Error Banner */}
      {(error || goalError || macroError) && (
        <View style={[styles.errorBanner, { 
          backgroundColor: theme.dangerLight, 
          borderColor: theme.danger,
          borderWidth: 1,
        }]}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, marginRight: 8, color: theme.danger }}>⚠️</Text>
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {error || goalError || macroError}
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
          Daily Nutrition
        </Text>
        <Text style={[{ fontSize: 16, color: theme.textSecondary, textAlign: 'center' }]}>
          {formatDate(date)}
        </Text>
      </View>

      {/* Nutrition Overview Chart */}
      <View style={[styles.chartContainer, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>
          📊 Progress Overview
        </Text>
        <View style={styles.chartWrapper}>
          <View style={styles.customChart}>
            {macros.map((macro, index) => {
              const value = actualMacros[macro.key];
              const goal = macroGoals[macro.key];
              const ratio = goal ? value / goal : 0;
              const heightPercent = Math.min(ratio * 100, 120); // Cap at 120% for visual purposes
              
              return (
                <View key={macro.key} style={styles.chartBar}>
                  <View style={styles.chartBarContainer}>
                    <View 
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: getProgressColor(ratio, macro.key),
                        }
                      ]}
                    />
                  </View>
                  <View style={styles.chartBarLabel}>
                    <Text style={[styles.chartBarIcon, { color: theme.textSecondary }]}>
                      {getMacroIcon(macro.key)}
                    </Text>
                    <Text style={[styles.chartBarText, { color: theme.textSecondary }]}>
                      {macro.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
          Percentage of daily goals achieved
        </Text>
      </View>

      {/* Daily Summary Cards */}
      <View style={[styles.summaryContainer, { 
        backgroundColor: theme.cardSecondary,
        borderColor: theme.border,
      }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>
          📈 Daily Summary
        </Text>
        <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
          Includes planned meals + AI-scanned items
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>
              {Math.round(actualMacros.calories)}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Total Calories
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.success }]}>
              {Math.round((actualMacros.calories / macroGoals.calories) * 100)}%
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Goal Progress
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.protein }]}>
              {Math.round(actualMacros.protein + actualMacros.carbs + actualMacros.fat)}g
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Total Macros
            </Text>
          </View>
        </View>
      </View>
      
      {macros.map((macro) => {
        const value = actualMacros[macro.key];
        const goal = macroGoals[macro.key];
        const ratio = goal ? value / goal : 0;
        const percent = Math.round(ratio * 100);
        const isOver = ratio > 1;
        const progressColor = getProgressColor(ratio, macro.key);
        const macroIcon = getMacroIcon(macro.key);

        return (
          <View key={macro.key} style={[styles.macroCard, { 
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          }]}>
            <View style={styles.macroHeader}>
              <View style={styles.macroTitleRow}>
                <Text style={styles.macroIcon}>{macroIcon}</Text>
                <Text style={[styles.macroLabel, { color: theme.text }]}>{macro.label}</Text>
              </View>
              <View style={styles.macroValueContainer}>
                <Text style={[styles.macroValue, { color: progressColor }]}>
                  {value}
                </Text>
                <Text style={[styles.macroGoal, { color: theme.textSecondary }]}>
                  / {goal}
                </Text>
                <Text style={[styles.macroUnit, { color: theme.textSecondary }]}>
                  {macro.key === 'calories' ? 'kcal' : 'g'}
                </Text>
              </View>
            </View>
            
            <View style={[styles.progressBarContainer, { backgroundColor: theme.divider }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(ratio, 1) * 100}%`,
                    backgroundColor: progressColor,
                  },
                ]}
              />
              {isOver && (
                <View
                  style={[
                    styles.progressBarOverrun,
                    {
                      width: `${Math.min((ratio - 1), 1) * 100}%`,
                      backgroundColor: theme.danger,
                    },
                  ]}
                />
              )}
            </View>
            
            <View style={styles.macroFooter}>
              <Text style={[styles.percentageText, { color: progressColor }]}>
                {percent}% of goal
              </Text>
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                {ratio < 0.5 ? "Keep going! 💪" : 
                 ratio < 0.8 ? "Getting close! 🎯" :
                 ratio <= 1 ? "Almost there! ⭐" :
                 `+${Math.round((ratio - 1) * goal)} over goal 🔥`}
              </Text>
            </View>
          </View>
        );
      })}
      
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 45, // Add top padding to avoid status bar overlap
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
    backgroundColor: "rgba(255,255,255,0.2)",
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
    marginBottom: 32,
    textAlign: "center",
  },
  chartContainer: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 20,
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
    width: 40,
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
  chartBarIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  chartBarText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  chart: {
    height: 180,
    width: screenWidth - 80,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  chartLabel: {
    alignItems: 'center',
    flex: 1,
  },
  chartLabelText: {
    fontSize: 20,
    marginBottom: 4,
  },
  chartLabelName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  summaryContainer: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  summarySubtitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  macroCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  macroHeader: {
    marginBottom: 16,
  },
  macroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  macroLabel: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  macroValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 32,
    fontWeight: "800",
  },
  macroGoal: {
    fontSize: 20,
    fontWeight: "600",
    marginLeft: 4,
  },
  macroUnit: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 16,
  },
  progressBar: {
    height: "100%",
    borderRadius: 6,
  },
  progressBarOverrun: {
    height: "100%",
    borderRadius: 6,
  },
  macroFooter: {
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: 'center',
  },
});

export default NutritionScreen;