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
import { Ionicons } from "@expo/vector-icons";
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
        <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading meal details...
          </Text>
        </View>
      </View>
    );
  }

  if (error && !meal) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <View style={[styles.errorContainer, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Ionicons name="warning-outline" size={48} color={theme.danger} />
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
            <Ionicons name="refresh-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
              Try Again
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.button, borderColor: theme.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
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
            <View style={[styles.imageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Image
                source={{ uri: item.content }}
                style={styles.mealImage}
                resizeMode="cover"
              />
            </View>
          )
        );
      case "title":
        return (
          <View style={[styles.titleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="restaurant-outline" size={28} color={theme.primary} />
            <Text style={[styles.title, { color: theme.text }]}>{item.content}</Text>
          </View>
        );
      case "instructions":
        return (
          item.content && (
            <View style={[styles.contentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="book-outline" size={24} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
              </View>
              <Text style={[styles.instructionsText, { color: theme.subtext }]}>{item.content}</Text>
            </View>
          )
        );
      case "ingredients":
        return (
          <View style={[styles.contentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="leaf-outline" size={24} color={theme.success} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Ingredients</Text>
            </View>
            {item.content && item.content.length > 0 ? (
              <View style={styles.ingredientsList}>
                {item.content.map((ingredient: string, index: number) => (
                  <View key={index} style={styles.ingredientItem}>
                    <Ionicons name="ellipse" size={6} color={theme.success} style={{ marginTop: 6 }} />
                    <Text style={[styles.ingredientText, { color: theme.subtext }]}>
                      {ingredient}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.noIngredientsText, { color: theme.subtext }]}>
                No ingredients available
              </Text>
            )}
          </View>
        );
      case "recipeLink":
        return (
          item.content && (
            <TouchableOpacity 
              style={[styles.linkCard, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
              onPress={() => Linking.openURL(item.content)}
            >
              <Ionicons name="link-outline" size={24} color={theme.primary} />
              <Text style={[styles.recipeLinkText, { color: theme.primary }]}>
                View Full Recipe
              </Text>
              <Ionicons name="arrow-forward-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          )
        );
      case "nutrition":
        return (
          <View style={[styles.nutritionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="fitness-outline" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Nutrition Information</Text>
            </View>
            <View style={styles.nutritionGrid}>
              <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                <Ionicons name="flame-outline" size={20} color={theme.warning} />
                <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Calories</Text>
                <Text style={[styles.nutritionValue, { color: theme.text }]}>{item.content.calories}</Text>
              </View>
              <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                <Ionicons name="barbell-outline" size={20} color={theme.protein} />
                <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Protein</Text>
                <Text style={[styles.nutritionValue, { color: theme.text }]}>{item.content.protein}g</Text>
              </View>
              <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                <Ionicons name="analytics-outline" size={20} color={theme.carbs} />
                <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Carbs</Text>
                <Text style={[styles.nutritionValue, { color: theme.text }]}>{item.content.carbohydrates}g</Text>
              </View>
              <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                <Ionicons name="water-outline" size={20} color={theme.fat} />
                <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Fat</Text>
                <Text style={[styles.nutritionValue, { color: theme.text }]}>{item.content.fat}g</Text>
              </View>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={data}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          error ? (
            <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
              <Ionicons name="warning" size={20} color={theme.danger} />
              <Text style={[styles.errorBannerText, { color: theme.danger }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.errorBannerRetry, { backgroundColor: theme.danger }]}
                onPress={handleRefresh}
              >
                <Text style={[styles.errorBannerRetryText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.actionContainer}>
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
                <View style={styles.buttonContent}>
                  <Ionicons name="trash-outline" size={20} color={theme.buttonText} />
                  <Text style={[styles.deleteButtonText, { color: theme.buttonText }]}>
                    Remove from Meal Plan
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.button, borderColor: theme.border }]}
              onPress={() => router.back()}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="arrow-back-outline" size={20} color={theme.buttonText} />
                <Text style={[styles.backButtonText, { color: theme.buttonText }]}>
                  Back to Calendar
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  // Enhanced Loading Card
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  // Enhanced Error Styles
  errorContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '90%',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Enhanced Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorBannerRetry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBannerRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  
  // Enhanced Card Styles
  imageCard: {
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  mealImage: { 
    width: "100%", 
    height: 250, 
    resizeMode: 'cover',
  },
  
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: { 
    fontSize: 24, 
    fontWeight: "800", 
    marginLeft: 12,
    textAlign: "center",
    flex: 1,
  },
  
  contentCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  
  // Instructions Styles
  instructionsText: { 
    fontSize: 15, 
    lineHeight: 24,
    fontWeight: '500',
  },
  
  // Ingredients Styles
  ingredientsList: {
    gap: 8,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ingredientText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    flex: 1,
  },
  noIngredientsText: { 
    fontSize: 15, 
    fontStyle: "italic", 
    textAlign: "center",
    fontWeight: '500',
  },
  
  // Link Card Styles
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  recipeLinkText: { 
    fontSize: 16, 
    fontWeight: "700", 
    textAlign: "center",
    marginHorizontal: 12,
  },
  
  // Nutrition Card Styles
  nutritionCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nutritionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  
  // Action Container
  actionContainer: {
    marginTop: 20,
    gap: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Enhanced Button Styles
  deleteButton: { 
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12, 
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  deleteButtonText: { 
    fontSize: 16, 
    fontWeight: "700",
    marginLeft: 8,
  },
  backButton: { 
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12, 
    alignItems: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: { 
    fontSize: 16, 
    fontWeight: "600",
    marginLeft: 8,
  },
  
  // Legacy styles (keeping for compatibility)
  instructionsTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginTop: 16, 
    marginBottom: 8, 
    textAlign: "center" 
  },
  ingredientsTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginTop: 16, 
    marginBottom: 8, 
    textAlign: "center" 
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
});

export default MealPlanDetails;