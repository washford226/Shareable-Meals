import React, { useEffect, useState, useCallback } from "react";
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
  RefreshControl,
  ScrollView,
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchMeal = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      // Validate user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Authentication required. Please log in again.");
      }

      if (!id) {
        throw new Error("Meal ID is required");
      }

      // id is the meal_plan row id
      const [{ data: mealPlanData, error: mealPlanError }, { data: ingredientsData, error: ingredientsError }] = await Promise.all([
        supabase
          .from("meal_plan")
          .select(
            `
            meal_plan_id,
            meal:meals (
              id,
              name,
              description,
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
          .eq("meal_plan_id", id)
          .single(),
        // Get ingredients for the meal
        supabase
          .from("meal_plan")
          .select("meal_id")
          .eq("meal_plan_id", id)
          .single()
          .then(async ({ data: planData, error: planError }) => {
            if (planError || !planData) return { data: null, error: planError };
            
            return supabase
              .from("meal_ingredients")
              .select("raw_name, quantity, unit")
              .eq("meal_id", planData.meal_id);
          })
      ]);

      if (mealPlanError || !mealPlanData || !mealPlanData.meal) {
        throw mealPlanError || new Error("Meal not found");
      }

      if (ingredientsError) {
        console.warn("Error fetching ingredients:", ingredientsError);
      }

      // Flatten meal data for easier rendering
      const mealData = Array.isArray(mealPlanData.meal) ? mealPlanData.meal[0] : mealPlanData.meal;
      setMeal({
        ...mealData,
        meal_plan_id: mealPlanData.meal_plan_id,
        ingredients: ingredientsData || []
      } as Meal);
      
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Failed to fetch meal:", error);
      const errorMessage = error.message || "Could not fetch meal details. Please try again.";
      setError(errorMessage);
      
      // Auto-retry with exponential backoff for network errors
      if (retryCount < 3 && !error.message?.includes("Authentication") && !error.message?.includes("not found")) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchMeal(isRefresh);
        }, delay);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, retryCount]);

  const handleRefresh = useCallback(() => {
    setRetryCount(0);
    fetchMeal(true);
  }, [fetchMeal]);

  useEffect(() => {
    if (id) {
      fetchMeal();
    }
  }, [id, fetchMeal]);

  const handleDeleteMeal = async () => {
    if (deleting) return; // Prevent multiple delete attempts

    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this meal from your meal plan? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              setError(null);

              if (!meal?.meal_plan_id) {
                throw new Error("Meal plan ID not found. Please refresh and try again.");
              }

              // Validate user authentication
              const { data: { user }, error: authError } = await supabase.auth.getUser();
              if (authError || !user) {
                throw new Error("Authentication required. Please log in again.");
              }

              const { error } = await supabase
                .from("meal_plan")
                .delete()
                .eq("meal_plan_id", meal.meal_plan_id);

              if (error) {
                throw new Error(error.message || "Failed to delete meal from plan");
              }

              Alert.alert(
                "Success", 
                "Meal removed from your meal plan successfully.", 
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch (error: any) {
              console.error("Error deleting meal:", error);
              const errorMessage = error.message || "Failed to delete the meal. Please try again.";
              setError(errorMessage);
              Alert.alert("Error", errorMessage);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading meal details...
        </Text>
      </View>
    );
  }

  if (error && !meal) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <View style={[styles.errorContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            Unable to Load Meal
          </Text>
          <Text style={[styles.errorText, { color: theme.text }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
              Try Again
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
        </View>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Meal not found</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: theme.buttonText }]}>
            Back to Calendar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ingredients = meal.ingredients && Array.isArray(meal.ingredients) 
    ? meal.ingredients.map(ing => `${ing.quantity} ${ing.unit || ''} ${ing.raw_name}`.trim())
    : [];

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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.danger }]}>
          <Text style={[styles.errorBannerText, { color: theme.buttonText }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.errorBannerRetry}
            onPress={handleRefresh}
          >
            <Text style={[styles.errorBannerRetryText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <FlatList
      data={data}
      keyExtractor={(item, index) => index.toString()}
      renderItem={renderItem}
      ListFooterComponent={
        <>
          <TouchableOpacity
            style={[
              styles.deleteButton, 
              { 
                backgroundColor: theme.danger,
                opacity: deleting ? 0.7 : 1
              }
            ]}
            onPress={handleDeleteMeal}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Text style={[styles.deleteButtonText, { color: theme.buttonText }]}>
                Remove from Meal Plan
              </Text>
            )}
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16 
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: '90%',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  errorBannerRetry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorBannerRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  mealImage: { 
    width: "100%", 
    height: 200, 
    borderRadius: 8, 
    marginBottom: 16 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 16, 
    textAlign: "center" 
  },
  instructionsTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginTop: 16, 
    marginBottom: 8, 
    textAlign: "center" 
  },
  instructionsText: { 
    fontSize: 14, 
    marginBottom: 16, 
    textAlign: "center",
    lineHeight: 20,
  },
  ingredientsTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginTop: 16, 
    marginBottom: 8, 
    textAlign: "center" 
  },
  ingredientItem: { 
    fontSize: 14, 
    marginBottom: 4, 
    textAlign: "center" 
  },
  noIngredientsText: { 
    fontSize: 14, 
    fontStyle: "italic", 
    textAlign: "center", 
    marginBottom: 16 
  },
  recipeLinkText: { 
    fontSize: 16, 
    fontWeight: "bold", 
    textAlign: "center", 
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
  nutritionTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginTop: 16, 
    marginBottom: 8, 
    textAlign: "center" 
  },
  nutritionContainer: { 
    flexDirection: "row", 
    justifyContent: "space-around", 
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  nutritionText: { 
    fontSize: 14, 
    fontWeight: "bold",
    marginBottom: 4,
  },
  deleteButton: { 
    marginTop: 16, 
    padding: 12, 
    borderRadius: 8, 
    alignItems: "center",
    opacity: 1,
  },
  deleteButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  backButton: { 
    marginTop: 24, 
    padding: 12, 
    borderRadius: 8, 
    alignItems: "center" 
  },
  backButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
});

export default MealPlanDetails;