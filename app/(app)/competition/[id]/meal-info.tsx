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
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "utils/supabase";

interface CompetitionMeal {
  id: number;
  user_id: string;
  name: string;
  description: string;
  instructions?: string;
  servings?: number;
  calories?: number;
  protein?: number;
  carbohydrates?: number; // Updated to match database schema
  fat?: number;
  recipeLink?: string;
  created_by_ai?: boolean;
  created_by?: string;
  favorite?: boolean;
  dietary_restrictions?: string; // Updated to match database schema
  cuisine?: string; // Updated to match database schema
  picture?: string; // For base64 image data or URL
  visibility?: boolean;
  created_at?: string;
  forever_invis?: boolean;
  ingredients?: MealIngredient[];
}

interface MealIngredient {
  raw_name: string;
  quantity: number;
  unit: string | null;
}

const CompetitionMealDetails = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [meal, setMeal] = useState<CompetitionMeal | null>(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [competitionInfo, setCompetitionInfo] = useState<{
    theme: string;
    votes: number;
    username: string;
  } | null>(null);
  const { theme } = useTheme();

  // Fetch meal by id from Supabase with competition context
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

      // Fetch competition-specific information
      const { data: competitionData, error: competitionError } = await supabase
        .from("competition_submissions")
        .select(`
          competition_id,
          weekly_competitions!competition_submissions_competition_id_fkey (
            competition_themes!fk_theme_id (
              theme_name
            )
          ),
          user_profiles!competition_submissions_user_id_fkey (
            username
          )
        `)
        .eq("meal_id", mealId)
        .single();

      // Fetch vote count for this meal
      const { data: voteData } = await supabase
        .from("meal_votes")
        .select("vote_id")
        .eq("meal_id", mealId);

      // Combine meal data with ingredients and competition info
      const mealWithIngredients: CompetitionMeal = {
        ...mealData,
        ingredients: ingredientsData || []
      };
      setMeal(mealWithIngredients);

      if (competitionData) {
        setCompetitionInfo({
          theme: "Competition Theme", // We'll handle this differently
          votes: voteData?.length || 0,
          username: "Competition User" // We'll handle this differently
        });
      }

      setRetryCount(0);

      if (ingredientsError) {
        console.warn("Error fetching ingredients:", ingredientsError);
      }
      if (competitionError) {
        console.warn("Error fetching competition info:", competitionError);
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
      fetchMealById(id);
    }
  }, [fetchMealById, id]);

  const handleCopy = async () => {
    if (!meal) return;

    setCopyLoading(true);
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setCopyLoading(false);
        return;
      }
      const userId = userData.user.id;

      // Create a new meal with the same data
      const newMeal = {
        name: `Copy of ${meal.name}`,
        description: meal.description,
        instructions: meal.instructions,
        servings: meal.servings,
        calories: meal.calories,
        protein: meal.protein,
        carbohydrates: meal.carbohydrates,
        fat: meal.fat,
        dietary_restrictions: meal.dietary_restrictions,
        cuisine: meal.cuisine,
        picture: meal.picture,
        user_id: userId,
        created_at: new Date().toISOString(),
        visibility: true,
        created_by_ai: meal.created_by_ai || false,
        favorite: false,
      };

      const { data: insertedMeal, error: mealError } = await supabase
        .from("meals")
        .insert([newMeal])
        .select()
        .single();

      if (mealError || !insertedMeal) {
        throw new Error("Failed to copy meal");
      }

      // Copy ingredients if they exist
      if (meal.ingredients && meal.ingredients.length > 0) {
        const ingredientPromises = meal.ingredients.map((ingredient: any) => {
          return supabase.from("meal_ingredients").insert([
            {
              meal_id: insertedMeal.id,
              raw_name: ingredient.raw_name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            },
          ]);
        });

        await Promise.all(ingredientPromises);
      }

      Alert.alert("Success", "Meal copied to your meals successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back to competition page
            router.back();
          },
        },
      ]);
    } catch (error) {
      console.error("Error copying meal:", error);
      Alert.alert("Error", "Failed to copy meal. Please try again.");
    } finally {
      setCopyLoading(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert("Error", "Please provide a reason for reporting this meal.");
      return;
    }

    setReportLoading(true);
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setReportLoading(false);
        return;
      }
      const userId = userData.user.id;

      // Check if user has already reported this meal
      const { data: existingReport, error: checkError } = await supabase
        .from("meal_reports")
        .select("*")
        .eq("meal_id", id)
        .eq("reporter_id", userId)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingReport) {
        Alert.alert("Already Reported", "You have already reported this meal.");
        setIsReportModalVisible(false);
        setReportReason("");
        setReportLoading(false);
        return;
      }

      // Submit report
      const { error: reportError } = await supabase.from("meal_reports").insert([
        {
          meal_id: id,
          reporter_id: userId,
          reason: reportReason.trim(),
          reported_at: new Date().toISOString(),
        },
      ]);

      if (reportError) {
        throw reportError;
      }

      Alert.alert("Report Submitted", "Thank you for your report. We will review it shortly.");
      setIsReportModalVisible(false);
      setReportReason("");
    } catch (error) {
      console.error("Error reporting meal:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchMealById(id);
    }
  }, [id, fetchMealById]);

  const formatTime = (minutes: number | undefined) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatNutrition = (value: number | undefined) => {
    return value ? `${value}g` : "N/A";
  };

  const formatCalories = (value: number | undefined) => {
    return value ? `${value} cal` : "N/A";
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Competition Meal
          </Text>
          <View style={styles.headerActions} />
        </View>

        <ScrollView 
          style={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { 
              backgroundColor: `${theme.danger}15`, 
              borderColor: theme.danger 
            }]}>
              <Ionicons name="warning-outline" size={20} color={theme.danger} />
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
          {retryCount > 0 && (
            <View style={[styles.retryBanner, { 
              backgroundColor: `${theme.warning}15`, 
              borderColor: theme.warning 
            }]}>
              <Ionicons name="refresh-outline" size={16} color={theme.warning} />
              <Text style={[styles.retryBannerText, { color: theme.warning }]}>
                Retry attempt {retryCount}/3
              </Text>
            </View>
          )}

          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal details...</Text>
            
            {error && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={handleRetry}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Competition Meal
          </Text>
          <View style={styles.headerActions} />
        </View>

        <ScrollView 
          style={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { 
              backgroundColor: `${theme.danger}15`, 
              borderColor: theme.danger 
            }]}>
              <Ionicons name="warning-outline" size={20} color={theme.danger} />
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

          {/* Empty State */}
          <View style={[styles.emptyStateCard, { backgroundColor: theme.card }]}>
            <View style={styles.emptyStateContent}>
              <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Meal Not Found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                {error || "The meal you're looking for could not be found."}
              </Text>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={16} color={theme.buttonText} />
                <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                  Go Back
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Competition Meal
        </Text>
        <TouchableOpacity 
          style={[styles.headerActionButton, { backgroundColor: `${theme.text}15` }]}
          onPress={() => setIsReportModalVisible(true)}
        >
          <Ionicons name="flag-outline" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Competition Context Card */}
        {competitionInfo && (
          <View style={[styles.competitionCard, { backgroundColor: theme.card }]}>
            <View style={styles.competitionHeader}>
              <Ionicons name="trophy" size={20} color={theme.primary} />
              <Text style={[styles.competitionTheme, { color: theme.primary }]}>
                {competitionInfo.theme}
              </Text>
            </View>
            <View style={styles.competitionMeta}>
              <View style={styles.creatorInfo}>
                <Ionicons name="person-circle-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.creatorText, { color: theme.textSecondary }]}>
                  by {competitionInfo.username}
                </Text>
              </View>
              <View style={styles.voteInfo}>
                <Ionicons name="heart" size={16} color={theme.primary} />
                <Text style={[styles.voteText, { color: theme.text }]}>
                  {competitionInfo.votes} votes
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Meal Image */}
        {meal.picture && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: meal.picture }} style={styles.mealImage} />
          </View>
        )}

        {/* Meal Info Card */}
        <View style={[styles.mealCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
          
          {meal.description && (
            <Text style={[styles.mealDescription, { color: theme.textSecondary }]}>
              {meal.description}
            </Text>
          )}

          {/* Meal Metadata */}
          <View style={styles.metadataContainer}>
            {meal.cuisine && (
              <View style={[styles.metadataBadge, { backgroundColor: `${theme.primary}20` }]}>
                <Text style={[styles.metadataText, { color: theme.primary }]}>
                  {meal.cuisine}
                </Text>
              </View>
            )}
            {meal.dietary_restrictions && (
              <View style={[styles.metadataBadge, { backgroundColor: `${theme.success}20` }]}>
                <Text style={[styles.metadataText, { color: theme.success }]}>
                  {meal.dietary_restrictions}
                </Text>
              </View>
            )}
            {meal.created_by_ai && (
              <View style={[styles.metadataBadge, { backgroundColor: `${theme.warning}20` }]}>
                <Text style={[styles.metadataText, { color: theme.warning }]}>
                  AI Generated
                </Text>
              </View>
            )}
          </View>

          {/* Time and Servings */}
          <View style={styles.timeServingsContainer}>
            <View style={styles.timeServingsItem}>
              <Ionicons name="people-outline" size={20} color={theme.primary} />
              <Text style={[styles.timeServingsLabel, { color: theme.textSecondary }]}>
                Serves
              </Text>
              <Text style={[styles.timeServingsValue, { color: theme.text }]}>
                {meal.servings || "N/A"}
              </Text>
            </View>
            {meal.created_by_ai && (
              <View style={styles.timeServingsItem}>
                <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
                <Text style={[styles.timeServingsLabel, { color: theme.textSecondary }]}>
                  AI Made
                </Text>
                <Text style={[styles.timeServingsValue, { color: theme.text }]}>
                  Yes
                </Text>
              </View>
            )}
            {meal.created_at && (
              <View style={styles.timeServingsItem}>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={[styles.timeServingsLabel, { color: theme.textSecondary }]}>
                  Created
                </Text>
                <Text style={[styles.timeServingsValue, { color: theme.text }]}>
                  {new Date(meal.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Nutrition Card */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="nutrition-outline" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Nutrition Information
            </Text>
          </View>
          
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatCalories(meal.calories)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                Calories
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatNutrition(meal.protein)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                Protein
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatNutrition(meal.carbohydrates)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                Carbs
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatNutrition(meal.fat)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                Fat
              </Text>
            </View>
          </View>
        </View>

        {/* Ingredients Card */}
        {meal.ingredients && meal.ingredients.length > 0 && (
          <View style={[styles.ingredientsCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Ingredients
              </Text>
            </View>
            
            {meal.ingredients.map((ingredient: any, index: number) => (
              <View key={index} style={styles.ingredientItem}>
                <View style={[styles.ingredientBullet, { backgroundColor: theme.primary }]} />
                <Text style={[styles.ingredientText, { color: theme.text }]}>
                  {ingredient.quantity && ingredient.unit 
                    ? `${ingredient.quantity} ${ingredient.unit} ${ingredient.raw_name}`
                    : ingredient.raw_name
                  }
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions Card */}
        {meal.instructions && (
          <View style={[styles.instructionsCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Instructions
              </Text>
            </View>
            
            <Text style={[styles.instructionsText, { color: theme.text }]}>
              {meal.instructions}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: theme.primary }]}
            onPress={handleCopy}
            disabled={copyLoading}
          >
            {copyLoading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Ionicons name="copy-outline" size={20} color={theme.buttonText} />
            )}
            <Text style={[styles.copyButtonText, { color: theme.buttonText }]}>
              {copyLoading ? "Copying..." : "Copy to My Meals"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Report Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isReportModalVisible}
        onRequestClose={() => setIsReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Report Meal
              </Text>
              <TouchableOpacity
                onPress={() => setIsReportModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              Please provide a reason for reporting this meal:
            </Text>
            
            <TextInput
              style={[
                styles.reportInput,
                {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Enter reason for reporting..."
              placeholderTextColor={theme.textSecondary}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: theme.border }]}
                onPress={() => setIsReportModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: theme.danger }]}
                onPress={handleReport}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: theme.buttonText }]}>
                    Submit Report
                  </Text>
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
    width: 44, // Match back button width for centering
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
  },

  // Scroll Container
  scrollContainer: {
    flex: 1,
  },

  // Error/Retry Banners
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

  // Loading and Empty States
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Competition Card
  competitionCard: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  competitionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  competitionTheme: {
    fontSize: 16,
    fontWeight: '600',
  },
  competitionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorText: {
    fontSize: 14,
  },
  voteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Image
  imageContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mealImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },

  // Meal Card
  mealCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mealDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metadataBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  metadataText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeServingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  timeServingsItem: {
    alignItems: 'center',
    gap: 4,
  },
  timeServingsLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeServingsValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Card Components
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

  // Nutrition Card
  nutritionCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Ingredients Card
  ingredientsCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientText: {
    fontSize: 16,
    flex: 1,
  },

  // Instructions Card
  instructionsCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsText: {
    fontSize: 16,
    lineHeight: 24,
  },

  // Action Buttons
  actionButtonsContainer: {
    margin: 16,
    marginTop: 0,
    gap: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
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
  modalDescription: {
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 22,
  },
  reportInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CompetitionMealDetails;
