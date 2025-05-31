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
import { supabase } from "app/utils_supabase";

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

  // Fetch user goals from Supabase
  const fetchUserGoals = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) return;
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("users")
        .select(
          "calories_goal, protein_goal, carbohydrates_goal, fat_goal"
        )
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

  // Fetch actual macros for the day from Supabase
  const fetchDayMacros = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) return;
      const userId = userData.user.id;

      // Get all meals for this user and date from meal_plan, join meals table for macros
      const { data, error } = await supabase
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
        .eq("date", date);

      if (error) throw error;

      // Sum up macros
      const totals = (data || []).reduce(
        (acc, entry) => ({
          calories: acc.calories + (entry.meal?.calories || 0),
          protein: acc.protein + (entry.meal?.protein || 0),
          carbs: acc.carbs + (entry.meal?.carbohydrates || 0),
          fat: acc.fat + (entry.meal?.fat || 0),
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