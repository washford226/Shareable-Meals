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
import { Ionicons } from "@expo/vector-icons";
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
          <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading meal information...
            </Text>
            {retryCount > 0 && (
              <Text style={[styles.retryText, { color: theme.warning }]}>
                Retry attempt {retryCount}/3...
              </Text>
            )}
          </View>
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: theme.card, borderColor: theme.danger }]}>
              <Ionicons name="warning-outline" size={32} color={theme.danger} />
              <Text style={[styles.errorTitle, { color: theme.danger }]}>
                Error Loading Meal
              </Text>
              <Text style={[styles.errorText, { color: theme.text }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={() => fetchMeal()}
              >
                <Ionicons name="refresh-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!meal && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <View style={[styles.errorContainer, { backgroundColor: theme.card, borderColor: theme.danger }]}>
            <Ionicons name="warning-outline" size={48} color={theme.danger} />
            <Text style={[styles.errorTitle, { color: theme.danger }]}>
              Meal Not Found
            </Text>
            <Text style={[styles.errorText, { color: theme.text }]}>
              {error || "The meal you're looking for couldn't be found."}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={() => fetchMeal()}
            >
              <Ionicons name="refresh-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
              <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                Try Again
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.button, borderColor: theme.border }]}
              onPress={() => router.push("/(app)/my-meals/meals")}
            >
              <Ionicons name="arrow-back-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
              <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Back Button */}
      <View style={[styles.topNavContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.topBackButton, { backgroundColor: theme.card }]}
          onPress={() => router.push("/(app)/my-meals/meals")}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && !loading && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="alert-circle" size={20} color={theme.danger} />
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

      {/* Retry Banner */}
      {retryCount > 0 && !loading && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Ionicons name="time" size={16} color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Meal Image Card */}
        <View style={[styles.imageCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          {meal?.picture && typeof meal.picture === "string" ? (
            <Image 
              source={{ 
                uri: meal.picture.startsWith('\\x') 
                  ? meal.picture.slice(2).match(/.{2}/g)?.map((hex: string) => String.fromCharCode(parseInt(hex, 16))).join('') || ''
                  : meal.picture
              }} 
              style={styles.mealImage} 
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="image" size={48} color={theme.subtext} />
              <Text style={[styles.imagePlaceholderText, { color: theme.subtext }]}>No Image</Text>
            </View>
          )}
          
          {/* AI Tag */}
          {meal?.created_by_ai && (
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={styles.aiTagText}>AI Generated</Text>
            </View>
          )}
        </View>

        {/* Meal Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <Text style={[styles.mealTitle, { color: theme.text }]}>{meal?.name || "Unknown Meal"}</Text>
          <Text style={[styles.mealDescription, { color: theme.subtext }]}>{meal?.description || "No description available"}</Text>
          
          {/* Creator Info */}
          {meal?.created_by && (
            <View style={styles.tagsContainer}>
              <View style={[styles.tag, { backgroundColor: theme.info + '20', borderColor: theme.info }]}>
                <Ionicons name="person" size={12} color={theme.info} />
                <Text style={[styles.tagText, { color: theme.info }]}>Created by: {meal.created_by}</Text>
              </View>
            </View>
          )}
          
          {/* Status Tags */}
          <View style={styles.tagsContainer}>
            {meal?.favorite && (
              <View style={[styles.tag, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
                <Ionicons name="heart" size={12} color={theme.warning} />
                <Text style={[styles.tagText, { color: theme.warning }]}>Favorite</Text>
              </View>
            )}
            {meal?.visibility === false && (
              <View style={[styles.tag, { backgroundColor: theme.danger + '20', borderColor: theme.danger }]}>
                <Ionicons name="eye-off" size={12} color={theme.danger} />
                <Text style={[styles.tagText, { color: theme.danger }]}>Private</Text>
              </View>
            )}
          </View>
          
          {/* Tags */}
          <View style={styles.tagsContainer}>
            {meal?.cuisine && (
              <View style={[styles.tag, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                <Ionicons name="globe" size={12} color={theme.primary} />
                <Text style={[styles.tagText, { color: theme.primary }]}>{meal.cuisine}</Text>
              </View>
            )}
            {meal?.dietary_restrictions && (
              <View style={[styles.tag, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
                <Ionicons name="leaf" size={12} color={theme.success} />
                <Text style={[styles.tagText, { color: theme.success }]}>{meal.dietary_restrictions}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Nutrition Card */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="nutrition" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Nutrition Facts</Text>
            {meal?.Edamam_macros && (
              <Image
                source={require('../../../../assets/images/Edamam_Badge_Transparent.png')}
                style={styles.edamamLogo}
                resizeMode="contain"
              />
            )}
          </View>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: '#FF8C00' }]}>{meal?.calories || 0}</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: '#FF0000' }]}>{meal?.protein || 0}g</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: '#0066FF' }]}>{meal?.carbohydrates || 0}g</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.fat }]}>{meal?.fat || 0}g</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Fat</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>{meal?.servings || 1}</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Servings</Text>
            </View>
          </View>
        </View>

        {/* Ingredients Card */}
        <View style={[styles.ingredientsCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={20} color={theme.success} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Ingredients</Text>
          </View>
          {meal?.ingredients && Array.isArray(meal.ingredients) && meal.ingredients.length > 0 ? (
            meal.ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <View style={[styles.ingredientBullet, { backgroundColor: theme.primary }]} />
                <Text style={[styles.ingredientText, { color: theme.text }]}>
                  {ingredient.quantity} {ingredient.unit || ''} {ingredient.raw_name}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.subtext }]}>No ingredients listed</Text>
          )}
        </View>

        {/* Instructions Card */}
        <View style={[styles.instructionsCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={20} color={theme.warning} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
          </View>
          <Text style={[styles.instructionsText, { color: theme.text }]}>{meal?.instructions || "No instructions provided"}</Text>
        </View>

        {/* Recipe Link Card */}
        {meal?.recipeLink && meal.recipeLink.trim() !== '' ? (
          <TouchableOpacity 
            style={[styles.linkCard, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
            onPress={() => meal?.recipeLink && Linking.openURL(meal.recipeLink)}
          >
            <Ionicons name="link-outline" size={24} color={theme.primary} />
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: theme.primary }]}>
                View Full Recipe
              </Text>
              <Text style={[styles.linkSubtext, { color: theme.primary }]} numberOfLines={1}>
                {meal.recipeLink}
              </Text>
            </View>
            <Ionicons name="arrow-forward-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => setIsModalVisible(true)}
            disabled={addingToMealPlan}
          >
            {addingToMealPlan ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={20} color={theme.buttonText} />
                <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>Add to Meal Plan</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { backgroundColor: theme.button, borderColor: theme.border, flex: 1 }]}
              onPress={() => router.push(`/my-meals/${id}/edit`)}
              disabled={deleting}
            >
              <Ionicons name="create" size={18} color={theme.text} />
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Edit Meal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton, { backgroundColor: theme.danger, flex: 1 }]}
              onPress={handleDeleteMeal}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <>
                  <Ionicons name="trash" size={18} color={theme.buttonText} />
                  <Text style={[styles.secondaryButtonText, { color: theme.buttonText }]}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Back Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.backToMealsButton, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => router.push("/(app)/my-meals/meals")}
        >
          <Ionicons name="arrow-back-outline" size={20} color={theme.text} />
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back to Meals</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Enhanced Modal for Adding to Meal Plan */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Meal Plan</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
              Choose when you&apos;d like to have this meal
            </Text>

            {/* Date Selection */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Date</Text>
              <TouchableOpacity
                style={[styles.dateInput, { borderColor: theme.border, backgroundColor: theme.background }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={[styles.dateText, { color: selectedDate ? theme.text : theme.placeholder }]}>
                  {selectedDate ? selectedDate : "Select Date"}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.subtext} />
              </TouchableOpacity>
            </View>

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

            {/* Meal Type Selection */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Meal Type</Text>
              <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Ionicons name="restaurant-outline" size={20} color={theme.primary} style={styles.pickerIcon} />
                <Picker
                  selectedValue={mealType}
                  onValueChange={(itemValue) => setMealType(itemValue)}
                  style={[styles.picker, { color: theme.text }]}
                >
                  <Picker.Item label="Breakfast" value="Breakfast" />
                  <Picker.Item label="Lunch" value="Lunch" />
                  <Picker.Item label="Dinner" value="Dinner" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>
            </View>

            {/* Modal Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleAddToMealPlan}
                disabled={addingToMealPlan}
              >
                {addingToMealPlan ? (
                  <ActivityIndicator color={theme.buttonText} size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="add-circle-outline" size={20} color={theme.buttonText} />
                    <Text style={[styles.buttonText, { color: theme.buttonText }]}>
                      Add to Plan
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
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
  },

  // Top Navigation Styles
  topNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    zIndex: 1000,
  },
  topBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Content Styles
  scrollContainer: {
    paddingBottom: 20,
  },

  // Image Card Styles
  imageCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  mealImage: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    marginTop: 8,
  },
  aiTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Info Card Styles
  infoCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  mealDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Card Components
  nutritionCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ingredientsCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  aiMacroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  aiMacroTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  edamamBadgeContainer: {
    marginLeft: 'auto',
  },
  edamamBadgeSmall: {
    width: 60,
    height: 20,
  },
  edamamBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Nutrition Styles
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Ingredients Styles
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  emptyText: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Instructions Styles
  instructionsText: {
    fontSize: 15,
    lineHeight: 24,
  },

  // Link Card
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    gap: 16,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  linkSubtext: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },

  // Action Buttons
  actionButtons: {
    margin: 16,
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  dangerButton: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  backToMealsButton: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Loading and Error States
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: '90%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
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
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 5,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryText: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  placeholder: {
    width: "100%",
    height: 250,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "600",
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  titleCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  titleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cardContent: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  contentCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  ingredientsList: {
    gap: 8,
  },
  actionContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Enhanced Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },

  // Modal Input Styles
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 16,
  },
  pickerIcon: {
    marginRight: 12,
  },
  picker: {
    flex: 1,
    height: 50,
  },

  // Modal Actions
  modalActions: {
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Edamam Logo
  edamamLogo: {
    width: 200,
    height: 40,
    marginLeft: 8,
  },

  // Legacy compatibility styles
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
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
});

export default MyMealInfo;