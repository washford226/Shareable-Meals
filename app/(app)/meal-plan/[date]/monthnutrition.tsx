import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import NutritionNav from "../../../../components/nutritionNav";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, subDays } from "date-fns";

const BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000"
    : "http://localhost:5000";

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

  // Fetch user goals
  const fetchUserGoals = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/users/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = response.data;
      setMacroGoals({
        calories: user.calories_goal ?? 2000,
        protein: user.protein_goal ?? 100,
        carbs: user.carbohydrates_goal ?? 200,
        fat: user.fat_goal ?? 70,
      });
    } catch (error) {
      console.error("Error fetching user goals:", error);
      Alert.alert("Error", "Could not fetch user goals.");
    }
  };

  // Fetch macros for each day in the month
  const fetchMonthData = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const dates = getLast30Dates();
      const results = await Promise.all(
        dates.map(async (d) => {
          const response = await axios.get(`${BASE_URL}/mealplan/meal-plan`, {
            params: { date: d },
            headers: { Authorization: `Bearer ${token}` },
          });
          const meals = Array.isArray(response.data) ? response.data : [];
          const totals = meals.reduce(
            (acc, meal) => ({
              calories: acc.calories + (meal.calories || 0),
              protein: acc.protein + (meal.protein || 0),
              carbs: acc.carbs + (meal.carbohydrates || 0),
              fat: acc.fat + (meal.fat || 0),
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

      {[...monthData].reverse().map((day, dayIdx) => (
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