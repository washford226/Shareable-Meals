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
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../../../context/ThemeContext";
import { Meal } from "../../../../types/types";
import { Ionicons } from "@expo/vector-icons";
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

      // Get user's username from user_profiles
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("username")
        .eq("user_id", userId)
        .single();

      const username = profileData?.username || "Unknown User";

      // Copy meal without id and ingredients (we'll handle ingredients separately)
      const { id: _id, ingredients: _ingredients, ...mealData } = meal;
      
      // 1. Insert the meal (without ingredients)
      const { data: newMealData, error: mealError } = await supabase.from("meals").insert([
        {
          ...mealData,
          user_id: userId,
          visibility: true, // Make copied meals public by default
          created_by: username,
          Edamam_macros: false, // Copied meals keep original macro values, not Edamam-generated
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
        // Get the current session to include in the function call
        const { data: { session } } = await supabase.auth.getSession();
        
        const { error: nutritionError } = await supabase.functions.invoke('calculate-nutrition', {
          body: { meal_id: newMealId },
          headers: session?.access_token ? {
            Authorization: `Bearer ${session.access_token}`
          } : undefined
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
          <View style={styles.centerContent}>
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Meal Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerActionButton, { backgroundColor: theme.button }]}
            onPress={() => setIsReportModalVisible(true)}
          >
            <Ionicons name="flag" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
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
          {meal.picture && typeof meal.picture === "string" ? (
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
          {meal.created_by_ai && (
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={styles.aiTagText}>AI Generated</Text>
            </View>
          )}
        </View>

        {/* Meal Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <Text style={[styles.mealTitle, { color: theme.text }]}>{meal.name}</Text>
          <Text style={[styles.mealDescription, { color: theme.subtext }]}>{meal.description}</Text>
          
          {/* Creator Info */}
          {meal.created_by && (
            <View style={styles.tagsContainer}>
              <View style={[styles.tag, { backgroundColor: theme.info + '20', borderColor: theme.info }]}>
                <Ionicons name="person" size={12} color={theme.info} />
                <Text style={[styles.tagText, { color: theme.info }]}>Created by: {meal.created_by}</Text>
              </View>
            </View>
          )}
          
          {/* Status Tags */}
          <View style={styles.tagsContainer}>
            {meal.favorite && (
              <View style={[styles.tag, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
                <Ionicons name="heart" size={12} color={theme.warning} />
                <Text style={[styles.tagText, { color: theme.warning }]}>Favorite</Text>
              </View>
            )}
            {meal.visibility === false && (
              <View style={[styles.tag, { backgroundColor: theme.danger + '20', borderColor: theme.danger }]}>
                <Ionicons name="eye-off" size={12} color={theme.danger} />
                <Text style={[styles.tagText, { color: theme.danger }]}>Private</Text>
              </View>
            )}
          </View>
          
          {/* Tags */}
          <View style={styles.tagsContainer}>
            {meal.cuisine && (
              <View style={[styles.tag, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                <Ionicons name="globe" size={12} color={theme.primary} />
                <Text style={[styles.tagText, { color: theme.primary }]}>{meal.cuisine}</Text>
              </View>
            )}
            {meal.dietary_restrictions && (
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
              <Text style={[styles.nutritionValue, { color: theme.primary }]}>{meal.calories || 0}</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.protein }]}>{meal.protein || 0}g</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.carbs }]}>{meal.carbohydrates || 0}g</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.fat }]}>{meal.fat || 0}g</Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Fat</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>{meal.servings || 1}</Text>
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
          {meal.ingredients && Array.isArray(meal.ingredients) && meal.ingredients.length > 0 ? (
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
          <Text style={[styles.instructionsText, { color: theme.text }]}>{meal.instructions || "No instructions provided"}</Text>
        </View>

        {/* Recipe Link Card */}
        {meal.recipeLink && meal.recipeLink.trim() !== '' ? (
          <TouchableOpacity 
            style={[styles.linkCard, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
            onPress={() => meal.recipeLink && Linking.openURL(meal.recipeLink)}
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
            onPress={handleCopyMeal}
            disabled={copyLoading}
          >
            {copyLoading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color={theme.buttonText} />
                <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>Add to My Meals</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { backgroundColor: theme.button, borderColor: theme.border, flex: 1 }]}
              onPress={() => router.push(`/(app)/reviews/${meal.id}/create-review`)}
            >
              <Ionicons name="star" size={18} color={theme.text} />
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Add Review</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { backgroundColor: theme.button, borderColor: theme.border, flex: 1 }]}
              onPress={() => router.push(`/(app)/reviews/${meal.id}/reviews`)}
            >
              <Ionicons name="chatbubbles" size={18} color={theme.text} />
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>View Reviews</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Enhanced Report Modal */}
      <Modal visible={isReportModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Report Meal</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setIsReportModalVisible(false);
                  setReportReason("");
                }}
                disabled={reportLoading}
              >
                <Ionicons name="close" size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={[styles.modalDescription, { color: theme.subtext }]}>
                Please describe why you&apos;re reporting this meal. Our team will review your report.
              </Text>
              
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <TextInput
                  style={[styles.modalInput, { color: theme.text }]}
                  placeholder="Enter reason for reporting..."
                  placeholderTextColor={theme.placeholder}
                  value={reportReason}
                  onChangeText={setReportReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton, { backgroundColor: theme.button, borderColor: theme.border }]}
                onPress={() => {
                  setIsReportModalVisible(false);
                  setReportReason("");
                }}
                disabled={reportLoading}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: theme.danger }]}
                onPress={handleReportMeal}
                disabled={reportLoading || !reportReason.trim()}
              >
                {reportLoading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <>
                    <Ionicons name="flag" size={16} color={theme.buttonText} />
                    <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Submit Report</Text>
                  </>
                )}
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
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44, // Account for status bar
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
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

  // Loading and Error States
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalInput: {
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelModalButton: {
    borderWidth: 1,
  },
  submitButton: {
    // Primary button styling applied via backgroundColor
  },

  // Legacy styles (keeping for compatibility)
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
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
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
  edamamLogo: {
    width: 200,
    height: 40,
    marginLeft: 8,
  },
});

export default MealDetails;