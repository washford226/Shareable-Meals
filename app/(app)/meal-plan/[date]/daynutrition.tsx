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

const BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000"
    : "http://localhost:5000";

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

  // Fetch actual macros for the day
  const fetchDayMacros = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/mealplan/meal-plan`, {
        params: { date },
        headers: { Authorization: `Bearer ${token}` },
      });
      const meals = Array.isArray(response.data) ? response.data : [];
      // Sum up macros
      const totals = meals.reduce(
        (acc, meal) => ({
          calories: acc.calories + (meal.calories || 0),
          protein: acc.protein + (meal.protein || 0),
          carbs: acc.carbs + (meal.carbohydrates || 0),
          fat: acc.fat + (meal.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      setActualMacros(totals);
    } catch (error) {
      console.error("Error fetching day macros:", error);
      Alert.alert("Error", "Could not fetch nutrition for this day.");
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUserGoals(), fetchDayMacros()]).finally(() =>
      setLoading(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
      <Text style={styles.title}>Nutrition for {date}</Text>
      {macros.map((macro) => {
        const value = actualMacros[macro.key];
        const goal = macroGoals[macro.key];
        const ratio = goal ? value / goal : 0;
        const percent = Math.round(ratio * 100);
        const isOver = ratio > 1;

        return (
          <View key={macro.key} style={styles.barGroup}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>{macro.label}</Text>
              <Text style={styles.barValue}>
                {value} / {goal} ({percent}%)
              </Text>
            </View>
            <View style={styles.barBackground}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(ratio, 1) * 100}%`,
                    backgroundColor: isOver ? "#f78c6b" : "#4f8ef7",
                  },
                ]}
              />
              {isOver && (
                <View
                  style={[
                    styles.barOverrun,
                    {
                      width: `${(ratio - 1) * 100}%`,
                    },
                  ]}
                />
              )}
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={styles.backButton} onPress={() => router.push("/(app)/meal-plan/calendar")}>
        <Text style={styles.backButtonText}>Back</Text>
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
  },
  barGroup: {
    marginBottom: 20,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  barValue: {
    fontSize: 14,
    color: "#333",
  },
  barBackground: {
    height: 20,
    backgroundColor: "#eee",
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
  },
  barFill: {
    height: "100%",
  },
  barOverrun: {
    height: "100%",
    backgroundColor: "#ff4d4d",
  },
});

export default NutritionScreen;