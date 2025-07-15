import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import NutritionNav from "../../../../components/nutritionNav";
import { format, subDays } from "date-fns";
import { supabase } from "utils/supabase";

type MacroKey = "calories" | "protein" | "carbs" | "fat";
const macroLabels = ["Calories", "Protein", "Carbs", "Fat"];
const macroKeys: MacroKey[] = ["calories", "protein", "carbs", "fat"];
const barColors = ["#4F8EF7", "#F7B32B", "#F76E5C", "#7ED957"];

const MonthNutritionScreen = () => {
  const { date } = useLocalSearchParams();
  const router = useRouter();

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
        .from("users")
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
            (acc, entry) => ({
              calories: acc.calories + (entry.meal?.calories ?? 0),
              protein: acc.protein + (entry.meal?.protein ?? 0),
              carbs: acc.carbs + (entry.meal?.carbohydrates ?? 0),
              fat: acc.fat + (entry.meal?.fat ?? 0),
            }),
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

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUserGoals(), fetchMonthData()]).finally(() =>
      setLoading(false)
    );
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
      <View style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <NutritionNav />

      <Text style={styles.title}>Monthly Nutrition Overview</Text>

      {/* Averages Block */}
      <View style={styles.averagesBlock}>
        <Text style={styles.averagesTitle}>Monthly Averages</Text>
        {macroLabels.map((label, i) => {
          const key = macroKeys[i];
          const value = averages[key];
          const goal = macroGoals[key];
          const percent = Math.min(1, value / goal);
          const over = value > goal;

          return (
            <View key={label} style={{ marginBottom: 14 }}>
              <Text style={styles.averageText}>
                {label}: {value} / {goal} {label === "Calories" ? "kcal" : "g"} ({Math.round((value / goal) * 100)}%)
              </Text>
              <View style={styles.progressBarBackground}>
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
                      styles.progressBarFill,
                      {
                        width: "100%",
                        backgroundColor: "#ff4444",
                        opacity: 0.3,
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {[...monthData].reverse().map((day) => (
        <View key={day.date} style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{day.date}</Text>
          {macroLabels.map((label, i) => {
            const key = macroKeys[i];
            const value = day[key];
            const goal = macroGoals[key];
            const percent = Math.min(1, value / goal);

            return (
              <View key={label} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 14, marginBottom: 2 }}>
                  {label}: {value} / {goal} {label === "Calories" ? "kcal" : "g"}
                </Text>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${percent * 100}%`,
                        backgroundColor: barColors[i],
                      },
                    ]}
                  />
                  {value > goal && (
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: "100%",
                          backgroundColor: "#ff4444",
                          opacity: 0.3,
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                        },
                      ]}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <TouchableOpacity style={styles.backButton} onPress={() => router.push("/(app)/meal-plan/calendar")}>
        <Text style={styles.backButtonText}>Back</Text>
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
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#ccc",
    borderRadius: 5,
  },
  backButtonText: {
    color: "#000",
    fontSize: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  averagesBlock: {
    backgroundColor: "#e6eaf0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  averagesTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 8,
    color: "#4F8EF7",
    textAlign: "center",
  },
  averageText: {
    fontSize: 15,
    marginBottom: 2,
    textAlign: "center",
    color: "#333",
  },
  dayBlock: {
    marginBottom: 24,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  progressBarBackground: {
    width: "100%",
    height: 14,
    backgroundColor: "#eee",
    borderRadius: 7,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 7,
  },
});

export default MonthNutritionScreen;