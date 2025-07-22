import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  Image,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import { Meal } from "../../../../types/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "utils/supabase";

const MyMealInfo = () => {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [addingToMealPlan, setAddingToMealPlan] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch meal from Supabase with retry logic
  const fetchMeal = useCallback(async (isRetry = false) => {
    setError(null);
    if (!isRetry) {
      setLoading(true);
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error("User not authenticated. Please log in.");
        }
        const userId = userData.user.id;

        if (!id) {
          throw new Error("Meal ID is required.");
        }

        // Fetch meal data and ingredients separately with better error handling
        const [mealResponse, ingredientsResponse] = await Promise.all([
          supabase
            .from("meals")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single(),
          supabase
            .from("meal_ingredients")
            .select("raw_name, quantity, unit")
            .eq("meal_id", id)
        ]);

        if (mealResponse.error || !mealResponse.data) {
          if (mealResponse.error?.code === 'PGRST116') {
            throw new Error("Meal not found or you don't have permission to view it.");
          }
          throw mealResponse.error || new Error("Failed to fetch meal data.");
        }

        if (ingredientsResponse.error) {
          console.warn("Error fetching ingredients:", ingredientsResponse.error);
          // Continue without ingredients rather than failing
        }

        // Combine meal data with ingredients
        const mealWithIngredients = {
          ...mealResponse.data,
          ingredients: ingredientsResponse.data || []
        };

        setMeal(mealWithIngredients);
        setRetryCount(0);
        return; // Success, exit retry loop

      } catch (error) {
        attempt++;
        console.error(`Error fetching meal (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : "Could not fetch meal data.";
          setError(errorMessage);
          
          if (errorMessage.includes("not found") || errorMessage.includes("permission")) {
            Alert.alert("Error", errorMessage, [
              { text: "Go Back", onPress: () => router.push("/(app)/my-meals/meals") }
            ]);
          }
        } else {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          setRetryCount(attempt);
        }
      }
    }
    
    setLoading(false);
  }, [id, router]);

  // Add meal to meal plan in Supabase with enhanced error handling
  const handleAddToMealPlan = useCallback(async () => {
    if (!selectedDate.trim()) {
      const errorMessage = "Please select a date.";
      setError(errorMessage);
      Alert.alert("Validation Error", errorMessage);
      return;
    }

    if (!id) {
      const errorMessage = "Meal ID is missing.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
      return;
    }

    setError(null);
    setAddingToMealPlan(true);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error("User not authenticated. Please log in.");
        }
        const userId = userData.user.id;

        // Check if meal already exists for this date and meal type
        const { data: existingMeal, error: checkError } = await supabase
          .from("meal_plan")
          .select("id")
          .eq("user_id", userId)
          .eq("meal_id", id)
          .eq("date", selectedDate)
          .eq("meal_type", mealType)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingMeal) {
          Alert.alert("Info", "This meal is already added to your meal plan for the selected date and meal type.");
          setIsModalVisible(false);
          return;
        }

        const { error } = await supabase.from("meal_plan").insert([
          {
            user_id: userId,
            meal_id: id,
            date: selectedDate,
            meal_type: mealType,
          },
        ]);

        if (error) {
          throw error;
        }

        Alert.alert("Success", "Meal added to the meal plan!");
        setIsModalVisible(false);
        setSelectedDate("");
        setMealType("Breakfast");
        return; // Success, exit retry loop

      } catch (error) {
        attempt++;
        console.error(`Error adding meal to meal plan (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : "Failed to add meal to the meal plan. Please try again later.";
          setError(errorMessage);
          Alert.alert("Error", errorMessage);
        } else {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setAddingToMealPlan(false);
  }, [selectedDate, id, mealType]);

  const handleDateSelection = useCallback((date: Date): void => {
    const formattedDate: string = format(date, "yyyy-MM-dd");
    setSelectedDate(formattedDate);
    setError(null); // Clear any date-related errors
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setRetryCount(0);
    
    try {
      await fetchMeal(true);
    } catch (error) {
      console.error("Error refreshing meal data:", error);
      setError("Failed to refresh meal data");
    } finally {
      setRefreshing(false);
    }
  }, [fetchMeal]);

  // Delete meal from Supabase with confirmation and enhanced error handling
  const handleDeleteMeal = useCallback(async () => {
    if (!id) {
      Alert.alert("Error", "Meal ID is missing.");
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this meal? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            setError(null);
            setDeleting(true);

            const maxRetries = 3;
            let attempt = 0;

            while (attempt < maxRetries) {
              try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError || !userData?.user) {
                  throw new Error("User not authenticated. Please log in.");
                }
                const userId = userData.user.id;

                // First, check if meal exists and belongs to user
                const { data: mealCheck, error: checkError } = await supabase
                  .from("meals")
                  .select("id")
                  .eq("id", id)
                  .eq("user_id", userId)
                  .single();

                if (checkError || !mealCheck) {
                  throw new Error("Meal not found or you don't have permission to delete it.");
                }

                // Delete meal (ingredients will be cascade deleted)
                const { error } = await supabase
                  .from("meals")
                  .delete()
                  .eq("id", id)
                  .eq("user_id", userId);

                if (error) {
                  throw error;
                }

                Alert.alert("Success", "Meal deleted successfully!");
                router.push("/(app)/my-meals/meals");
                return; // Success, exit retry loop

              } catch (error) {
                attempt++;
                console.error(`Error deleting meal (attempt ${attempt}):`, error);
                
                if (attempt >= maxRetries) {
                  const errorMessage = error instanceof Error ? error.message : "An error occurred while deleting the meal.";
                  setError(errorMessage);
                  Alert.alert("Error", errorMessage);
                } else {
                  // Wait before retrying with exponential backoff
                  const delay = Math.pow(2, attempt - 1) * 1000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
            }
            
            setDeleting(false);
          }
        }
      ]
    );
  }, [id, router]);

  useEffect(() => {
    fetchMeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal information...</Text>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={() => fetchMeal()}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {retryCount > 0 && (
            <Text style={[styles.retryText, { color: theme.warning }]}>
              Retry attempt {retryCount}/3...
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (!meal && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error || "Meal not found."}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => fetchMeal()}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
              Try Again
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.button }]}
            onPress={() => router.push("/(app)/my-meals/meals")}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
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
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={() => setError(null)}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {retryCount > 0 && (
        <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.warning }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3...
          </Text>
        </View>
      )}

      {/* Meal Picture */}
      {meal?.picture ? (
        <Image
          source={{ uri: typeof meal.picture === "string" ? meal.picture : "" }}
          style={styles.mealImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.card }]}>
          <Text style={[styles.placeholderText, { color: theme.subtext }]}>No Image Available</Text>
        </View>
      )}

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Meal Name */}
        <Text style={[styles.title, { color: theme.text }]}>{meal?.name || "Unknown Meal"}</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.subtext }]}>{meal?.description || "No description available"}</Text>

        {/* Instructions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
        <Text style={[styles.details, { color: theme.text }]}>{meal?.instructions || "No instructions provided"}</Text>

        {/* Dietary Restriction */}
        {meal?.dietary_restrictions && (
          <Text style={[styles.details, { color: theme.text, fontWeight: "bold", marginBottom: 8 }]}>
            Dietary Restriction: {meal.dietary_restrictions}
          </Text>
        )}
        {/* Cuisine */}
        {meal?.cuisine && (
          <Text style={[styles.details, { color: theme.text, fontWeight: "bold", marginBottom: 8 }]}>
            Cuisine: {meal.cuisine}
          </Text>
        )}

        {/* Meal Link */}
        {meal?.recipeLink && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recipe Link</Text>
            <Text
              style={[styles.linkText, { color: theme.primary }]}
              onPress={() => meal?.recipeLink && Linking.openURL(meal.recipeLink)}
            >
              {meal.recipeLink}
            </Text>
          </>
        )}
        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
        {meal?.ingredients && Array.isArray(meal.ingredients) ? (
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

        {/* Nutrition Info */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition Info</Text>
        <View style={styles.nutritionContainer}>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Calories: {meal?.calories || 'N/A'}
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Protein: {meal?.protein || 'N/A'}g
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Carbs: {meal?.carbohydrates || 'N/A'}g
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Fat: {meal?.fat || 'N/A'}g
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => setIsModalVisible(true)}
          disabled={addingToMealPlan}
        >
          {addingToMealPlan ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add to Meal Plan</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/my-meals/${id}/edit`)}
          disabled={deleting}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Edit Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.danger }]}
          onPress={handleDeleteMeal}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Delete Meal</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push("/(app)/my-meals/meals")}
          disabled={deleting}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Adding to Meal Plan */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Meal Plan</Text>

            <TouchableOpacity
              style={[styles.input, { borderColor: theme.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: theme.text }}>
                {selectedDate ? selectedDate : "Select Date"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ? new Date(selectedDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    handleDateSelection(date);
                  }
                }}
              />
            )}

            <View style={[styles.pickerContainer, { borderColor: theme.border }]}>
              <Picker
                selectedValue={mealType}
                onValueChange={(itemValue) => setMealType(itemValue)}
                style={{ color: theme.text }}
              >
                <Picker.Item label="Breakfast" value="Breakfast" />
                <Picker.Item label="Lunch" value="Lunch" />
                <Picker.Item label="Dinner" value="Dinner" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleAddToMealPlan}
              disabled={addingToMealPlan}
            >
              {addingToMealPlan ? (
                <ActivityIndicator color={theme.buttonText} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.danger }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    width: "100%",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  mealImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholder: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  details: {
    fontSize: 14,
    marginBottom: 8,
  },
  nutritionContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  linkText: {
    fontSize: 16,
    textDecorationLine: "underline",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  errorContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
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
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 5,
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

export default MyMealInfo;