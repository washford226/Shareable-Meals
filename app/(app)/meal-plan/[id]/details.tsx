import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Meal } from "../../../../types/types";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const MealPlanDetails = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeal = async () => {
      try {
        // id is the meal_plan row id
        const { data, error } = await supabase
          .from("meal_plan")
          .select(
            `
            meal_plan_id: id,
            meal:meals (
              id,
              name,
              description,
              ingredients,
              instructions,
              picture,
              recipeLink,
              calories,
              protein,
              carbohydrates,
              fat
            )
          `
          )
          .eq("id", id)
          .single();

        if (error || !data || !data.meal) {
          throw error || new Error("Meal not found");
        }

        // Flatten meal data for easier rendering
        setMeal({
          ...data.meal[0],
          meal_plan_id: data.meal_plan_id,
        });
      } catch (error) {
        console.error("Failed to fetch meal:", error);
        Alert.alert("Error", "Could not fetch meal details.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchMeal();
  }, [id]);

  const handleDeleteMeal = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this meal? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!meal) {
                Alert.alert("Error", "Meal not loaded.");
                return;
              }

              const { error } = await supabase
                .from("meal_plan")
                .delete()
                .eq("id", meal.meal_plan_id);

              if (error) throw error;

              Alert.alert("Success", "Meal deleted successfully.");
              router.back();
            } catch (error) {
              console.error("Error deleting meal:", error);
              Alert.alert("Error", "Failed to delete the meal. Please try again.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Meal not found</Text>
      </View>
    );
  }

  const ingredients =
    typeof meal.ingredients === "string"
      ? meal.ingredients.split(",").map((ingredient) => ingredient.trim())
      : meal.ingredients;

  const data = [
    { type: "picture", content: meal.picture },
    { type: "title", content: meal.name },
    { type: "instructions", content: meal.instructions },
    { type: "ingredients", content: ingredients },
    { type: "recipeLink", content: meal.recipeLink },
    { type: "nutrition", content: meal },
  ];

  const renderItem = ({ item }: { item: any }) => {
    switch (item.type) {
      case "picture":
        return (
          item.content && (
            <Image
              source={{ uri: item.content }}
              style={styles.mealImage}
              resizeMode="cover"
            />
          )
        );
      case "title":
        return <Text style={[styles.title, { color: theme.text }]}>{item.content}</Text>;
      case "instructions":
        return (
          item.content && (
            <>
              <Text style={[styles.instructionsTitle, { color: theme.text }]}>Instructions:</Text>
              <Text style={[styles.instructionsText, { color: theme.subtext }]}>{item.content}</Text>
            </>
          )
        );
      case "ingredients":
        return (
          <>
            <Text style={[styles.ingredientsTitle, { color: theme.text }]}>Ingredients:</Text>
            {item.content && item.content.length > 0 ? (
              item.content.map((ingredient: string, index: number) => (
                <Text
                  key={index}
                  style={[styles.ingredientItem, { color: theme.subtext }]}
                >
                  - {ingredient}
                </Text>
              ))
            ) : (
              <Text style={[styles.noIngredientsText, { color: theme.subtext }]}>
                No ingredients available
              </Text>
            )}
          </>
        );
      case "recipeLink":
        return (
          item.content && (
            <Text
              style={[styles.recipeLinkText, { color: theme.primary }]}
              onPress={() => Linking.openURL(item.content)}
            >
              {item.content}
            </Text>
          )
        );
      case "nutrition":
        return (
          <>
            <Text style={[styles.nutritionTitle, { color: theme.text }]}>
              Nutrition Info:
            </Text>
            <View style={styles.nutritionContainer}>
              <Text style={[styles.nutritionText, { color: theme.text }]}>
                Calories: {item.content.calories}
              </Text>
              <Text style={[styles.nutritionText, { color: theme.text }]}>
                Protein: {item.content.protein}g
              </Text>
              <Text style={[styles.nutritionText, { color: theme.text }]}>
                Carbs: {item.content.carbohydrates}g
              </Text>
              <Text style={[styles.nutritionText, { color: theme.text }]}>
                Fat: {item.content.fat}g
              </Text>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item, index) => index.toString()}
      renderItem={renderItem}
      ListFooterComponent={
        <>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: theme.danger }]}
            onPress={handleDeleteMeal}
          >
            <Text style={[styles.deleteButtonText, { color: theme.buttonText }]}>
              Delete Meal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.button }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: theme.buttonText }]}>
              Back to Calendar
            </Text>
          </TouchableOpacity>
        </>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  mealImage: { width: "100%", height: 200, borderRadius: 8, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  instructionsTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8, textAlign: "center" },
  instructionsText: { fontSize: 14, marginBottom: 16, textAlign: "center" },
  ingredientsTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8, textAlign: "center" },
  ingredientItem: { fontSize: 14, marginBottom: 4, textAlign: "center" },
  noIngredientsText: { fontSize: 14, fontStyle: "italic", textAlign: "center", marginBottom: 16 },
  recipeLinkText: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  nutritionTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8, textAlign: "center" },
  nutritionContainer: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16 },
  nutritionText: { fontSize: 14, fontWeight: "bold" },
  deleteButton: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: "center" },
  deleteButtonText: { fontSize: 16, fontWeight: "bold" },
  backButton: { marginTop: 24, padding: 12, borderRadius: 8, alignItems: "center" },
  backButtonText: { fontSize: 16, fontWeight: "bold" },
});

export default MealPlanDetails;