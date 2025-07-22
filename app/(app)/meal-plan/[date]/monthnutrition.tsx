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

const MonthNutritionScreen = () => {
  const { date } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

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

      // For each date, fetch all meals for that day and sum macros
      const results = await Promise.all(
        dates.map(async (d) => {
          const { data: mealPlan, error } = await supabase
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
            .eq("date", d);

          if (error) {
            return { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 };
          }

          const totals = (mealPlan || []).reduce(
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
          return { date: d, ...totals };
        })
      );
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
  const averages = macroKeys.reduce((acc, key) => {
    const sum = monthData.reduce((total, day) => total + day[key], 0);
    acc[key] = monthData.length ? Math.round(sum / monthData.length) : 0;
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

      <Text style={[styles.title, { color: theme.text }]}>Monthly Nutrition Overview</Text>

      {/* Averages Block */}
      <View style={[styles.averagesBlock, { backgroundColor: theme.card }]}>
        <Text style={[styles.averagesTitle, { color: theme.primary }]}>Monthly Averages</Text>
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
                  <View style={[styles.progressBarOverrun, { backgroundColor: theme.danger }]} />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Show last 7 days only for performance */}
      {monthData.slice(-7).reverse().map((day) => (
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
      
      <Text style={[styles.summaryText, { color: theme.subtext }]}>
        Showing last 7 days. Monthly averages calculated from all 30 days.
      </Text>
      
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
  summaryText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    marginVertical: 16,
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

export default MonthNutritionScreen;