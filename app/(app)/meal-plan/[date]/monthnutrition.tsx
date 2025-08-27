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
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import NutritionNav from "../../../../components/nutritionNav";
import { format, subDays } from "date-fns";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

type MacroKey = "calories" | "protein" | "carbs" | "fat";

const MonthNutritionScreen = () => {
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

  const getMacroIcon = (macroKey: MacroKey) => {
    const macro = macros.find(m => m.key === macroKey);
    return macro?.icon || "📊";
  };

  const [macroGoals, setMacroGoals] = useState({
    calories: 2000,
    protein: 100,
    carbs: 200,
    fat: 70,
  });
  const [monthData, setMonthData] = useState<
    { date: string; calories: number; protein: number; carbs: number; fat: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the last 30 days including the current date
  const getLast30Dates = () => {
    const baseDate = date ? new Date(date as string) : new Date();
    return Array.from({ length: 30 }).map((_, i) =>
      format(subDays(baseDate, 29 - i), "yyyy-MM-dd")
    );
  };

  // Fetch user goals from Supabase
  const fetchUserGoals = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) return;
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("calories_goal, protein_goal, carbohydrates_goal, fat_goal")
        .eq("id", userId)
        .single();

      if (error || !data) return;

      setMacroGoals({
        calories: data.calories_goal ?? 2000,
        protein: data.protein_goal ?? 100,
        carbs: data.carbohydrates_goal ?? 200,
        fat: data.fat_goal ?? 70,
      });
    } catch (error) {
      console.error("Error fetching user goals:", error);
      Alert.alert("Error", "Could not fetch user goals.");
    }
  };

  // Fetch macros for each day in the month from Supabase
  const fetchMonthData = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) return;
      const userId = userData.user.id;
      const dates = getLast30Dates();

      // For each date, fetch both meal plan data and macro meals data
      const results = await Promise.all(
        dates.map(async (d) => {
          try {
            // Fetch both data sources in parallel
            const [mealPlanResponse, macroMealsResponse] = await Promise.all([
              supabase
                .from("meal_plan")
                .select(
                  `
                  meal:meals (
                    calories,
                    protein,
                    carbohydrates,
                    fat
                  )
                `
                )
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
                const meal = Array.isArray(entry.meal) ? entry.meal[0] : entry.meal;
                return {
                  calories: acc.calories + (meal?.calories ?? 0),
                  protein: acc.protein + (meal?.protein ?? 0),
                  carbs: acc.carbs + (meal?.carbohydrates ?? 0),
                  fat: acc.fat + (meal?.fat ?? 0),
                };
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
      
      console.log("Monthly nutrition data (including AI-scanned meals):", results);
      setMonthData(results);
    } catch (error) {
      console.error("Error fetching month data:", error);
      Alert.alert("Error", "Could not fetch monthly nutrition.");
    }
  };

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      await Promise.all([fetchUserGoals(), fetchMonthData()]);
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
      await Promise.all([fetchUserGoals(), fetchMonthData()]);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load monthly nutrition data.");
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
    const sum = monthData.reduce((total, day) => total + day[macro.key], 0);
    acc[macro.key] = monthData.length ? Math.round(sum / monthData.length) : 0;
    return acc;
  }, {} as Record<MacroKey, number>);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading monthly nutrition data...
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
          Month Nutrition
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={{ paddingTop: 10 }}>
        <NutritionNav />

        {/* Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { 
            backgroundColor: theme.danger,
            shadowColor: theme.shadow,
          }]}>
            <Text style={[styles.errorText, { color: theme.buttonTextPrimary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRefresh}
            >
              <Text style={[styles.retryButtonText, { color: theme.buttonTextPrimary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={[styles.title, { color: theme.text }]}>
            📅 Monthly Nutrition
          </Text>
          <Text style={[{ fontSize: 16, color: theme.textSecondary, textAlign: 'center' }]}>
            30-day nutrition overview and trends
          </Text>
          <Text style={[{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 4, fontStyle: 'italic' }]}>
            Includes planned meals and AI-scanned meals
          </Text>
        </View>

      {/* Enhanced Monthly Averages Block */}
      <View style={[styles.averagesContainer, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.averagesTitle, { color: theme.text }]}>
          📊 Monthly Averages
        </Text>
        <View style={styles.averagesGrid}>
          {macros.map((macro) => {
            const value = averages[macro.key];
            const goal = macroGoals[macro.key];
            const ratio = goal ? value / goal : 0;
            const percent = Math.round(ratio * 100);
            
            return (
              <View key={macro.key} style={[styles.averageCard, { 
                backgroundColor: theme.background,
                borderColor: theme.border,
              }]}>
                <View style={styles.averageHeader}>
                  <Text style={[styles.averageIcon, { color: getMacroColor(macro.key) }]}>
                    {macro.icon}
                  </Text>
                  <Text style={[styles.averageLabel, { color: theme.text }]}>
                    {macro.label}
                  </Text>
                </View>
                <View style={styles.averageValues}>
                  <Text style={[styles.averageValue, { color: getMacroColor(macro.key) }]}>
                    {value}
                  </Text>
                  <Text style={[styles.averageGoal, { color: theme.textSecondary }]}>
                    / {goal} {macro.unit}
                  </Text>
                </View>
                <View style={[styles.averageProgressBar, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.averageProgressFill,
                      {
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: getMacroColor(macro.key),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.averagePercent, { 
                  color: ratio > 1 ? theme.danger : ratio > 0.8 ? theme.success : theme.textSecondary 
                }]}>
                  {percent}% of goal
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Enhanced Recent Days */}
      <View style={[styles.recentDaysContainer, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.recentDaysTitle, { color: theme.text }]}>
          📅 Recent 7 Days
        </Text>
        <Text style={[styles.recentDaysSubtitle, { color: theme.textSecondary }]}>
          Daily nutrition breakdown
        </Text>
        
        {monthData.slice(-7).reverse().map((day) => (
          <View key={day.date} style={[styles.dayCard, { 
            backgroundColor: theme.background,
            borderColor: theme.border,
          }]}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayLabel, { color: theme.text }]}>
                {format(new Date(day.date), "EEEE, MMMM d")}
              </Text>
              <Text style={[styles.dayCalories, { color: theme.primary }]}>
                {Math.round(day.calories)} kcal
              </Text>
            </View>
            
            <View style={styles.dayMacrosGrid}>
              {macros.slice(1).map((macro) => { // Skip calories as it's already shown
                const value = day[macro.key];
                const goal = macroGoals[macro.key];
                const ratio = goal ? value / goal : 0;
                const percent = Math.round(ratio * 100);

                return (
                  <View key={macro.key} style={styles.dayMacroItem}>
                    <View style={styles.dayMacroHeader}>
                      <Text style={[styles.dayMacroIcon, { color: getMacroColor(macro.key) }]}>
                        {macro.icon}
                      </Text>
                      <Text style={[styles.dayMacroLabel, { color: theme.textSecondary }]}>
                        {macro.label}
                      </Text>
                    </View>
                    <Text style={[styles.dayMacroValue, { color: theme.text }]}>
                      {Math.round(value)}/{goal} {macro.unit}
                    </Text>
                    <View style={[styles.dayMacroProgressBar, { backgroundColor: theme.border }]}>
                      <View
                        style={[
                          styles.dayMacroProgressFill,
                          {
                            width: `${Math.min(percent, 100)}%`,
                            backgroundColor: getMacroColor(macro.key),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.dayMacroPercent, { 
                      color: ratio > 1 ? theme.danger : ratio > 0.8 ? theme.success : theme.textSecondary 
                    }]}>
                      {percent}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      
      <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
        Showing recent 7 days • Monthly averages from all 30 days
      </Text>
      
      {/* Edamam Attribution */}
      <View style={styles.attributionContainer}>
        <Image 
          source={require("../../../../assets/images/Edamam_Badge_Transparent.svg")}
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
    backgroundColor: "rgba(255,255,255,0.2)",
    marginLeft: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  
  // Enhanced Averages Section
  averagesContainer: {
    marginBottom: 32,
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
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  averageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  averageIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  averageLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  averageValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  averageValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  averageGoal: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  averageProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  averageProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  averagePercent: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Enhanced Recent Days Section
  recentDaysContainer: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  recentDaysTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  recentDaysSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  dayCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  dayCalories: {
    fontSize: 18,
    fontWeight: "800",
  },
  dayMacrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayMacroItem: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayMacroHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dayMacroIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  dayMacroLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  dayMacroValue: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  dayMacroProgressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dayMacroProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  dayMacroPercent: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  summaryText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    marginVertical: 16,
  },
  backButton: {
    alignSelf: "center",
    marginTop: 16,
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
  
  // Legacy styles (maintained for compatibility)
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

export default MonthNutritionScreen;