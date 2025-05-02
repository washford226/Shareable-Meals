import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, FlatList } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Meal } from "../../../../types/types";
import { useTheme } from "../../../../context/ThemeContext";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const MealPlanDetails = () => {
  const { id } = useLocalSearchParams(); // Assumes the route is /meal-plan/[id]
  const router = useRouter();
  const { theme } = useTheme();

  const [meal, setMeal] = useState<Meal | null>(null);

  useEffect(() => {
    const fetchMeal = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await axios.get(`${BASE_URL}/meal-plan/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMeal(response.data);
      } catch (error) {
        console.error("Failed to fetch meal:", error);
        Alert.alert("Error", "Could not fetch meal details.");
      }
    };

    if (id) fetchMeal();
  }, [id]);

  const handleDeleteMeal = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !meal) {
        Alert.alert("Error", "You are not logged in or meal not loaded.");
        return;
      }

      await axios.delete(`${BASE_URL}/meal-plan/${meal.meal_plan_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert("Success", "Meal deleted successfully.");
      router.back(); // Go back instead of onBack()
    } catch (error) {
      console.error("Error deleting meal:", error);
      Alert.alert("Error", "Failed to delete the meal. Please try again.");
    }
  };

  if (!meal) return <Text>Loading...</Text>;

  const ingredients =
    typeof meal.ingredients === "string"
      ? meal.ingredients.split(",").map((ingredient) => ingredient.trim())
      : meal.ingredients;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>{meal.name}</Text>
      <Text style={[styles.description, { color: theme.subtext }]}>{meal.description}</Text>
      <Text style={[styles.details, { color: theme.text }]}>Calories: {meal.calories}</Text>
      <Text style={[styles.details, { color: theme.text }]}>Protein: {meal.protein}g</Text>
      <Text style={[styles.details, { color: theme.text }]}>Carbs: {meal.carbohydrates}g</Text>
      <Text style={[styles.details, { color: theme.text }]}>Fat: {meal.fat}g</Text>
      <Text
        style={[
          styles.details,
          { color: theme.mealColors[meal.meal_type.toLowerCase() as keyof typeof theme.mealColors] || theme.text },
        ]}
      >
        Meal Type: {meal.meal_type}
      </Text>

      <Text style={[styles.ingredientsTitle, { color: theme.text }]}>Ingredients:</Text>
      {ingredients && ingredients.length > 0 ? (
        <FlatList
          data={ingredients}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <Text style={[styles.ingredientItem, { color: theme.subtext }]}>- {item}</Text>
          )}
        />
      ) : (
        <Text style={[styles.noIngredientsText, { color: theme.subtext }]}>No ingredients available</Text>
      )}

      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: theme.danger }]}
        onPress={handleDeleteMeal}
      >
        <Text style={[styles.deleteButtonText, { color: theme.buttonText }]}>Delete Meal</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.button }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back to Calendar</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  description: { fontSize: 16, marginBottom: 16, textAlign: "center" },
  details: { fontSize: 14, marginBottom: 8, textAlign: "center" },
  ingredientsTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8, textAlign: "center" },
  ingredientItem: { fontSize: 14, marginBottom: 4, textAlign: "center" },
  noIngredientsText: { fontSize: 14, fontStyle: "italic", textAlign: "center", marginBottom: 16 },
  deleteButton: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: "center" },
  deleteButtonText: { fontSize: 16, fontWeight: "bold" },
  backButton: { marginTop: 24, padding: 12, borderRadius: 8, alignItems: "center" },
  backButtonText: { fontSize: 16, fontWeight: "bold" },
});

export default MealPlanDetails;
