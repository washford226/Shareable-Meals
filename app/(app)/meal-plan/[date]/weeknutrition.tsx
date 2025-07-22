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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import NutritionNav from "../../../../components/nutritionNav";
import { format, subDays } from "date-fns";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

type MacroKey = "calories" | "protein" | "carbs" | "fat";
const macroLabels = ["Calories", "Protein", "Carbs", "Fat"];
const macroKeys: MacroKey[] = ["calories", "protein", "carbs", "fat"];
const barColors = ["#4F8EF7", "#F7B32B", "#F76E5C", "#7ED957"];

const WeekNutritionScreen = () => {
  const { date } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

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

      // For each date, fetch all meals for that day and sum macros
      const results = await Promise.all(
        dates.map(async (d) => {
          try {
            const { data: mealPlan, error } = await supabase
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
              .eq("date", d);

            if (error) {
              console.error(`Error fetching data for ${d}:`, error.message);
              return { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 };
            }

            const totals = (mealPlan || []).reduce(
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
            return { date: d, ...totals };
          } catch (dayError) {
            console.error(`Unexpected error fetching data for ${d}:`, dayError);
            return { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 };
          }
        })
      );
      
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
  const averages = macroKeys.reduce((acc, key) => {
    const sum = weekData.reduce((total, day) => total + day[key], 0);
    acc[key] = weekData.length ? Math.round(sum / weekData.length) : 0;
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
      <NutritionNav />

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.danger }]}>
          <Text style={[styles.errorText, { color: theme.buttonText }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>Weekly Nutrition Overview</Text>

      {/* Averages Block */}
      <View style={[styles.averagesBlock, { backgroundColor: theme.card }]}>
        <Text style={[styles.averagesTitle, { color: theme.primary }]}>Weekly Averages</Text>
        {macroLabels.map((label, i) => {
          const key = macroKeys[i];
          const value = averages[key];
          const goal = macroGoals[key];
          const percent = Math.min(1, value / goal);
          const over = value > goal;

          return (
            <View key={label} style={{ marginBottom: 14 }}>
              <Text style={[styles.averageText, { color: theme.text }]}>
                {label}: {value} / {goal} {label === "Calories" ? "kcal" : "g"} ({Math.round((value / goal) * 100)}%)
              </Text>
              <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${percent * 100}%`,
                      backgroundColor: barColors[i],
                    },
                  ]}
                />
                {over && (
                  <View
                    style={[
                      styles.progressBarOverrun,
                      {
                        backgroundColor: theme.danger,
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {[...weekData].reverse().map((day) => (
        <View key={day.date} style={[styles.dayBlock, { borderBottomColor: theme.border }]}>
          <Text style={[styles.dayLabel, { color: theme.text }]}>
            {format(new Date(day.date), "EEEE, MMMM d")}
          </Text>
          {macroLabels.map((label, i) => {
            const key = macroKeys[i];
            const value = day[key];
            const goal = macroGoals[key];
            const percent = Math.min(1, value / goal);
            const isOver = value > goal;

            return (
              <View key={label} style={{ marginBottom: 10 }}>
                <Text style={[styles.macroText, { color: theme.text }]}>
                  {label}: {value} / {goal} {label === "Calories" ? "kcal" : "g"} ({Math.round((value / goal) * 100)}%)
                </Text>
                <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${percent * 100}%`,
                        backgroundColor: barColors[i],
                      },
                    ]}
                  />
                  {isOver && (
                    <View style={[styles.progressBarOverrun, { backgroundColor: theme.danger }]} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
      
      <TouchableOpacity 
        style={[styles.backButton, { backgroundColor: theme.button }]} 
        onPress={() => router.push("/(app)/meal-plan/calendar")}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back to Calendar</Text>
      </TouchableOpacity>
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
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginLeft: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  backButton: {
    alignSelf: "flex-start",
    marginTop: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: "#ccc",
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  backButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  averagesBlock: {
    backgroundColor: "#e6eaf0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  averagesTitle: {
    fontWeight: "bold",
    fontSize: 20,
    marginBottom: 12,
    color: "#4F8EF7",
    textAlign: "center",
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
  dayLabel: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
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
});

export default WeekNutritionScreen;