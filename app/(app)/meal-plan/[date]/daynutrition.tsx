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
import { format } from "date-fns";
import NutritionNav from "../../../../components/nutritionNav";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

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

      // Get all meals for this user and date from meal_plan, join meals table for macros
      const { data, error } = await supabase
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
        .eq("date", date);

      if (error) {
        console.error("Error fetching day macros:", error.message);
        
        // Retry logic for network errors
        if (retryCount < 2 && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log(`Retrying fetchDayMacros, attempt ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchDayMacros(retryCount + 1);
        }
        
        setMacroError(`Failed to load nutrition data for ${formatDate(date)}.`);
        return false;
      }

      // Sum up macros with better data handling
      const totals = (data || []).reduce(
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
      
      setActualMacros(totals);
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
  const getProgressColor = (ratio: number) => {
    if (ratio < 0.5) return "#4CAF50"; // Green
    if (ratio < 0.8) return theme.warning || "#FF9800"; // Orange
    if (ratio <= 1) return theme.primary || "#2196F3"; // Blue
    return theme.danger || "#F44336"; // Red
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
      
      {/* Error Banner */}
      {(error || goalError || macroError) && (
        <View style={[styles.errorBanner, { backgroundColor: theme.danger }]}>
          <Text style={[styles.errorText, { color: theme.buttonText }]}>
            {error || goalError || macroError}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>
        Nutrition for {formatDate(date)}
      </Text>
      
      {macros.map((macro) => {
        const value = actualMacros[macro.key];
        const goal = macroGoals[macro.key];
        const ratio = goal ? value / goal : 0;
        const percent = Math.round(ratio * 100);
        const isOver = ratio > 1;
        const progressColor = getProgressColor(ratio);

        return (
          <View key={macro.key} style={[styles.barGroup, { borderBottomColor: theme.border }]}>
            <View style={styles.barLabelRow}>
              <Text style={[styles.barLabel, { color: theme.text }]}>{macro.label}</Text>
              <Text style={[styles.barValue, { color: theme.subtext }]}>
                {value} / {goal} ({percent}%)
              </Text>
            </View>
            <View style={[styles.barBackground, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(ratio, 1) * 100}%`,
                    backgroundColor: progressColor,
                  },
                ]}
              />
              {isOver && (
                <View
                  style={[
                    styles.barOverrun,
                    {
                      width: `${Math.min((ratio - 1), 1) * 100}%`,
                      backgroundColor: theme.danger,
                    },
                  ]}
                />
              )}
            </View>
            {/* Progress indicator text */}
            <Text style={[styles.progressText, { color: theme.subtext }]}>
              {ratio < 0.5 ? "Keep going!" : 
               ratio < 0.8 ? "Getting close!" :
               ratio <= 1 ? "Almost there!" :
               "Goal exceeded!"}
            </Text>
          </View>
        );
      })}
      
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
  barGroup: {
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  barValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  barBackground: {
    height: 24,
    backgroundColor: "#eee",
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
  },
  barFill: {
    height: "100%",
    borderRadius: 12,
  },
  barOverrun: {
    height: "100%",
    backgroundColor: "#ff4d4d",
  },
  progressText: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "center",
  },
});

export default NutritionScreen;