import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../../../context/ThemeContext";
import { Meal } from "../../../../types/types";
import { supabase } from "utils/supabase";

const MealDetails = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const { theme } = useTheme();

  // Fetch meal by id from Supabase
  const fetchMealById = useCallback(async (mealId: string, showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Fetch meal data and ingredients separately
      const [{ data: mealData, error: mealError }, { data: ingredientsData, error: ingredientsError }] = await Promise.all([
        supabase
          .from("meals")
          .select("*")
          .eq("id", mealId)
          .single(),
        supabase
          .from("meal_ingredients")
          .select("raw_name, quantity, unit")
          .eq("meal_id", mealId)
      ]);

      if (mealError || !mealData) {
        throw new Error("Failed to fetch meal details");
      }

      // Combine meal data with ingredients
      const mealWithIngredients = {
        ...mealData,
        ingredients: ingredientsData || []
      };
      setMeal(mealWithIngredients);
      setRetryCount(0);

      if (ingredientsError) {
        console.warn("Error fetching ingredients:", ingredientsError);
      }
    } catch (error) {
      console.error("Error fetching meal:", error);
      setError("Failed to load meal details. Please check your connection and try again.");
      setMeal(null);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, []);

  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: wait 1s, 2s, 4s, etc.
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
    
    setTimeout(() => {
      if (id && typeof id === "string") {
        fetchMealById(id);
      }
    }, delay);
  }, [retryCount, fetchMealById, id]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRetryCount(0);
    if (id && typeof id === "string") {
      fetchMealById(id, false);
    }
  }, [fetchMealById, id]);

  // Report meal (insert into a 'reports' table)
  const handleReportMeal = async () => {
    if (!reportReason.trim()) {
      Alert.alert("Error", "Please provide a reason for reporting this meal.");
      return;
    }

    setReportLoading(true);
    try {
      if (!meal) {
        Alert.alert("Error", "Meal details are not available.");
        return;
      }
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
      const userId = userData.user.id;

      const { error } = await supabase.from("reports").insert([
        {
          meal_id: meal.id,
          user_id: userId,
          reason: reportReason.trim(),
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Meal reported successfully!");
      setIsReportModalVisible(false);
      setReportReason("");
    } catch (err) {
      console.error("Error reporting meal:", err);
      Alert.alert("Error", "Failed to report meal. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  // Copy meal to user's meals
  const handleCopyMeal = async () => {
    setCopyLoading(true);
    try {
      if (!meal) {
        Alert.alert("Error", "Meal details are not available.");
        return;
      }
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
      const userId = userData.user.id;

      // Copy meal without id and ingredients (we'll handle ingredients separately)
      const { id: _id, ingredients: _ingredients, ...mealData } = meal;
      
      // 1. Insert the meal (without ingredients)
      const { data: newMealData, error: mealError } = await supabase.from("meals").insert([
        {
          ...mealData,
          user_id: userId,
          visibility: true, // Make copied meals public by default
        },
      ]).select("id").single();

      if (mealError) {
        throw mealError;
      }

      const newMealId = newMealData?.id;
      if (!newMealId) {
        throw new Error("Failed to get new meal ID.");
      }

      // 2. Copy ingredients if they exist
      if (meal.ingredients && meal.ingredients.length > 0) {
        const ingredientRows = meal.ingredients.map(ingredient => ({
          meal_id: newMealId,
          raw_name: ingredient.raw_name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        }));

        const { error: ingredientsError } = await supabase
          .from("meal_ingredients")
          .insert(ingredientRows);

        if (ingredientsError) {
          throw ingredientsError;
        }
      }

      // 3. Calculate nutrition data using the edge function
      try {
        const { error: nutritionError } = await supabase.functions.invoke('calculate-nutrition', {
          body: { meal_id: newMealId }
        });
        
        if (nutritionError) {
          console.warn("Failed to calculate nutrition:", nutritionError);
          // Don't fail the whole process if nutrition calculation fails
        }
      } catch (nutritionErr) {
        console.warn("Nutrition calculation error:", nutritionErr);
        // Continue even if nutrition calculation fails
      }

      Alert.alert("Success", "Meal copied successfully!");
    } catch (err) {
      console.error("Error copying meal:", err);
      Alert.alert("Error", "Failed to copy meal. Please try again.");
    } finally {
      setCopyLoading(false);
    }
  };

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchMealById(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal details...</Text>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                Retry
              </Text>
            </TouchableOpacity>
            {retryCount > 0 && (
              <Text style={[styles.retryText, { color: theme.subtext }]}>
                Retry attempt {retryCount}/3
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.centerContent, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>
          {error || "Meal not found."}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={handleRetry}
        >
          <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
            Retry
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button, marginTop: 10 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && !loading && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !loading && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Meal Picture */}
        {meal.picture && typeof meal.picture === "string" ? (
          <Image source={{ uri: meal.picture }} style={styles.mealPicture} resizeMode="cover" />
        ) : (
          <View style={styles.mealPicturePlaceholder}>
            <Text style={[styles.mealPicturePlaceholderText, { color: theme.placeholder }]}>No Picture</Text>
          </View>
        )}

        {/* Meal Name */}
        <Text style={[styles.title, { color: theme.text }]}>{meal.name}</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.subtext }]}>{meal.description}</Text>

        {/* Instructions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
        <Text style={[styles.details, { color: theme.text }]}>{meal.instructions}</Text>

        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
        {meal.ingredients && Array.isArray(meal.ingredients) ? (
          meal.ingredients.length > 0 ? (
            meal.ingredients.map((ing, idx: number) => (
              <Text key={idx} style={[styles.details, { color: theme.text }]}>
                {ing.quantity} {ing.unit || ''} {ing.raw_name}
              </Text>
            ))
          ) : (
            <Text style={[styles.details, { color: theme.text }]}>No ingredients listed.</Text>
          )
        ) : (
          <Text style={[styles.details, { color: theme.text }]}>No ingredients available.</Text>
        )}

        {/* Cuisine */}
        {meal.cuisine && (
          <Text style={[styles.details, { color: theme.text, fontWeight: "bold", marginBottom: 8 }]}>
            Cuisine: {meal.cuisine}
          </Text>
        )}

        {/* Nutrition Info */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition Info</Text>
        <View style={styles.nutritionContainer}>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Calories: {meal.calories}</Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Protein: {meal.protein}g</Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Carbs: {meal.carbohydrates}g</Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Fat: {meal.fat}g</Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/(app)/reviews/${meal.id}/create-review`)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add Review</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/(app)/reviews/${meal.id}/reviews`)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>View Reviews</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={handleCopyMeal}
          disabled={copyLoading}
        >
          {copyLoading ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add Meal</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.danger }]}
          onPress={() => setIsReportModalVisible(true)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Report Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={isReportModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Report Meal</Text>
            <TextInput
              style={[styles.modalInput, { 
                borderColor: theme.border, 
                color: theme.text,
                backgroundColor: theme.background 
              }]}
              placeholder="Enter reason for reporting"
              placeholderTextColor={theme.placeholder}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleReportMeal}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Submit</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.danger }]}
                onPress={() => {
                  setIsReportModalVisible(false);
                  setReportReason("");
                }}
                disabled={reportLoading}
              >
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    color: "#6c757d",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "left",
  },
  details: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
    textAlign: "left",
  },
  nutritionContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    marginTop: 8,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    color: "#dc3545",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    borderColor: "#ccc",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  mealPicture: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: "center",
  },
  mealPicturePlaceholder: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 16,
  },
  mealPicturePlaceholderText: {
    fontSize: 16,
    color: "#6c757d",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 5,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  retryText: {
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  retryBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default MealDetails;