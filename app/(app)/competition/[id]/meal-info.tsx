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
  carbohydrates?: number; 
  fat?: number;
  recipeLink?: string;
  created_by_ai?: boolean;
  created_by?: string;
  favorite?: boolean;
  dietary_restrictions?: string; 
  cuisine?: string; 
  picture?: string; 
  visibility?: boolean;
  created_at?: string;
  forever_invis?: boolean;
  Edamam_macros?: boolean; 
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

  const fetchMealById = useCallback(async (mealId: string, showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
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

      const { data: competitionData, error: competitionError } = await supabase
        .from("competition_submissions")
        .select(`
          competition_id,
          user_id,
          weekly_competitions!competition_submissions_competition_id_fkey (
            theme_id
          ),
          user_profiles!competition_submissions_user_id_fkey (
            username
          )
        `)
        .eq("meal_id", mealId)
        .single();

      const { data: voteData } = await supabase
        .from("meal_votes")
        .select("vote_id")
        .eq("meal_id", mealId);

      const mealWithIngredients: CompetitionMeal = {
        ...mealData,
        ingredients: ingredientsData || []
      };
      setMeal(mealWithIngredients);

      if (competitionData) {
        let themeName = "Competition Theme";
        if (competitionData.weekly_competitions?.[0]?.theme_id) {
          const { data: themeData } = await supabase
            .from("competition_themes")
            .select("theme_name")
            .eq("theme_id", competitionData.weekly_competitions[0].theme_id)
            .single();
          
          themeName = themeData?.theme_name || "Competition Theme";
        }

        setCompetitionInfo({
          theme: themeName,
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setCopyLoading(false);
        return;
      }
      const userId = userData.user.id;

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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setReportLoading(false);
        return;
      }
      const userId = userData.user.id;

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
                onPress={handleRetry}
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

  if (!meal) {
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
              onPress={handleRetry}
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
        {/* Competition Info Card */}
        {competitionInfo && (
          <View style={[styles.competitionCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
            <View style={styles.competitionHeader}>
              <Ionicons name="trophy" size={20} color={theme.primary} />
              <Text style={[styles.competitionTheme, { color: theme.text }]}>
                {competitionInfo.theme}
              </Text>
            </View>
            <View style={styles.competitionMeta}>
              <View style={styles.creatorInfo}>
                <Ionicons name="person-circle" size={16} color={theme.textSecondary} />
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
          
          {competitionInfo && (
            <View style={styles.competitionInfo}>
              <View style={[styles.tag, { backgroundColor: `${theme.primary}20`, borderColor: theme.primary }]}>
                <Ionicons name="trophy" size={12} color={theme.primary} />
                <Text style={[styles.tagText, { color: theme.primary }]}>Competition Entry</Text>
              </View>
            </View>
          )}

          {/* Status Tags */}
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

        <View style={[styles.nutritionCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="nutrition" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Nutrition Facts</Text>
            {meal.Edamam_macros && (
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

        <View style={[styles.instructionsCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={20} color={theme.warning} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
          </View>
          <Text style={[styles.instructionsText, { color: theme.text }]}>
            {meal.instructions || "No instructions provided"}
          </Text>
        </View>

        {meal.recipeLink && meal.recipeLink.trim() !== '' ? (
          <View 
            style={[styles.linkCard, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
          >
            <Ionicons name="document-text-outline" size={24} color={theme.primary} />
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: theme.primary }]}>
                Recipe Source
              </Text>
              <Text style={[styles.linkSubtext, { color: theme.primary }]} numberOfLines={1}>
                {meal.recipeLink}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actionButtons}>
          <View style={styles.mainActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.primary, flex: 1 }]}
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

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.danger, backgroundColor: theme.background, flex: 1 }]}
              onPress={() => setIsReportModalVisible(true)}
              disabled={reportLoading}
            >
              <Ionicons name="flag-outline" size={20} color={theme.danger} />
              <Text style={[styles.secondaryButtonText, { color: theme.danger }]}>Report Meal</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, styles.backToMealsButton, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back-outline" size={20} color={theme.text} />
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back to Competition</Text>
        </TouchableOpacity>
      </ScrollView>   
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
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerActions: {
    width: 44,
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
  },
  scrollContainer: {
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
    fontSize: 16,
    marginTop: 16,
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
    marginTop: 20,
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
    marginTop: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
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
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
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
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
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
    gap: 16,
  },
  mainActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 16,
  },
  backToMealsButton: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 8,
    marginBottom: 16,
  },
  
  // Edamam Logo
  edamamLogo: {
    width: 200,
    height: 40,
    marginLeft: 8,
  },
});

export default CompetitionMealDetails;
