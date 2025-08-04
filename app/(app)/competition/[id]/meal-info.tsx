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
  Platform,
  Linking,
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
  AI_Macros?: boolean; // Indicates if AI was used to calculate macros
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
          theme: competitionData.weekly_competitions?.[0]?.competition_themes?.[0]?.theme_name || "Competition Theme",
          votes: voteData?.length || 0,
          username: competitionData.user_profiles?.[0]?.username || "Unknown User"
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
      {/* Top Back Button */}
      <View style={[styles.topNavContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.topBackButton, { backgroundColor: theme.card }]}
          onPress={() => router.back()}
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
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.cardSecondary }]}>
              <Ionicons name="image-outline" size={48} color={theme.subtext} />
              <Text style={[styles.imagePlaceholderText, { color: theme.subtext }]}>
                No Image Available
              </Text>
            </View>
          )}
          
          {meal.created_by_ai && (
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={styles.aiTagText}>AI</Text>
            </View>
          )}

          {/* Competition Vote Badge */}
          {competitionInfo && (
            <View style={[styles.voteBadge, { backgroundColor: theme.primary }]}>
              <Ionicons name="heart" size={12} color="#fff" />
              <Text style={styles.voteBadgeText}>{competitionInfo.votes}</Text>
            </View>
          )}
        </View>

        {/* Meal Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <Text style={[styles.mealTitle, { color: theme.text }]}>{meal.name}</Text>
          <Text style={[styles.mealDescription, { color: theme.subtext }]}>
            {meal.description || "No description available"}
          </Text>
          
          {/* Creator Info */}
          {meal.created_by && (
            <View style={styles.tagsContainer}>
              <View style={[styles.tag, { backgroundColor: theme.info + '20', borderColor: theme.info }]}>
                <Ionicons name="person" size={12} color={theme.info} />
                <Text style={[styles.tagText, { color: theme.info }]}>Created by: {meal.created_by}</Text>
              </View>
            </View>
          )}
          
          {/* Competition Info */}
          {competitionInfo && (
            <View style={styles.competitionInfo}>
              <View style={[styles.tag, { backgroundColor: `${theme.primary}20`, borderColor: theme.primary }]}>
                <Ionicons name="trophy" size={12} color={theme.primary} />
                <Text style={[styles.tagText, { color: theme.primary }]}>Competition Entry</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: `${theme.success}20`, borderColor: theme.success }]}>
                <Ionicons name="person" size={12} color={theme.success} />
                <Text style={[styles.tagText, { color: theme.success }]}>by {competitionInfo.username}</Text>
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
            {meal.AI_Macros && (
              <View style={[styles.tag, { backgroundColor: theme.info + '20', borderColor: theme.info }]}>
                <Ionicons name="calculator" size={12} color={theme.info} />
                <Text style={[styles.tagText, { color: theme.info }]}>AI Macros</Text>
              </View>
            )}
          </View>

          {/* Tags Container */}
          <View style={styles.tagsContainer}>
            {meal.cuisine && (
              <View style={[styles.tag, { backgroundColor: `${theme.primary}20`, borderColor: theme.primary }]}>
                <Ionicons name="restaurant" size={12} color={theme.primary} />
                <Text style={[styles.tagText, { color: theme.primary }]}>{meal.cuisine}</Text>
              </View>
            )}
            {meal.dietary_restrictions && (
              <View style={[styles.tag, { backgroundColor: `${theme.success}20`, borderColor: theme.success }]}>
                <Ionicons name="leaf" size={12} color={theme.success} />
                <Text style={[styles.tagText, { color: theme.success }]}>{meal.dietary_restrictions}</Text>
              </View>
            )}
            {meal.created_by_ai && (
              <View style={[styles.tag, { backgroundColor: `${theme.warning}20`, borderColor: theme.warning }]}>
                <Ionicons name="sparkles" size={12} color={theme.warning} />
                <Text style={[styles.tagText, { color: theme.warning }]}>AI Generated</Text>
              </View>
            )}
          </View>
        </View>

        {/* Nutrition Card */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="nutrition" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Nutrition Information</Text>
          </View>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatCalories(meal.calories)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>
                Calories
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatNutrition(meal.protein)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>
                Protein
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatNutrition(meal.carbohydrates)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>
                Carbs
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {formatNutrition(meal.fat)}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>
                Fat
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {meal.servings || 1}
              </Text>
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>
                Servings
              </Text>
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
            meal.ingredients.map((ingredient: any, index: number) => (
              <View key={index} style={styles.ingredientItem}>
                <View style={[styles.ingredientBullet, { backgroundColor: theme.success }]} />
                <Text style={[styles.ingredientText, { color: theme.text }]}>
                  {ingredient.quantity && ingredient.unit 
                    ? `${ingredient.quantity} ${ingredient.unit} ${ingredient.raw_name}`
                    : ingredient.raw_name
                  }
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              No ingredients listed
            </Text>
          )}
        </View>

        {/* Instructions Card */}
        <View style={[styles.instructionsCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={20} color={theme.warning} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
          </View>
          <Text style={[styles.instructionsText, { color: theme.text }]}>
            {meal.instructions || "No instructions provided"}
          </Text>
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
            onPress={handleCopy}
            disabled={copyLoading}
          >
            {copyLoading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Ionicons name="copy-outline" size={20} color={theme.buttonText} />
            )}
            <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
              {copyLoading ? "Copying..." : "Copy to My Meals"}
            </Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.danger, backgroundColor: theme.background }]}
              onPress={() => setIsReportModalVisible(true)}
              disabled={reportLoading}
            >
              <Ionicons name="flag-outline" size={20} color={theme.danger} />
              <Text style={[styles.secondaryButtonText, { color: theme.danger }]}>Report Meal</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Back Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.backToMealsButton, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back-outline" size={20} color={theme.text} />
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back to Competition</Text>
        </TouchableOpacity>
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
    paddingBottom: 20,
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

  // Additional styles from info.tsx to match design
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
  voteBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  voteBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
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
  competitionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
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
  emptyText: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  actionButtons: {
    margin: 16,
    marginTop: 8,
    gap: 12,
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
});

export default CompetitionMealDetails;
