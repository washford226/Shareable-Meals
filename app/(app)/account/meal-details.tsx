import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface MealDetails {
  id: number;
  name: string;
  description: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  instructions?: string;
  recipeLink?: string;
  created_by_ai: boolean;
  created_by?: string;
  favorite: boolean;
  dietary_restrictions?: string;
  servings?: number;
  cuisine?: string;
  picture?: string;
  visibility: boolean;
  forever_invis: boolean;
  created_at: string;
  user_id: string;
  creator_username?: string;
  Edamam_macros?: boolean;
}

interface MealIngredient {
  meal_ingredient_id: number;
  meal_id: number;
  raw_name?: string;
  quantity?: number;
  unit?: string;
  food_id?: number;
}

const AdminMealDetailsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { mealId, reportId } = useLocalSearchParams<{ mealId: string; reportId: string }>();
  const [meal, setMeal] = useState<MealDetails | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (mealId) {
      fetchMealDetails();
    }
  }, [mealId]);

  const fetchMealDetails = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const { data, error: mealError } = await supabase
        .from('meals')
        .select(`*`)
        .eq('id', parseInt(mealId))
        .single();

      if (mealError) {
        console.error('Error fetching meal details:', mealError);
        throw new Error(mealError.message || 'Failed to fetch meal details');
      }

      // Get username from user_profiles using the user_id
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', data.user_id)
        .single();

      if (userError) {
        console.warn('Error fetching user profile:', userError);
        // Don't fail completely if user profile can't be fetched
      }

      // Get meal ingredients
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('meal_ingredients')
        .select('*')
        .eq('meal_id', parseInt(mealId));

      if (ingredientsError) {
        console.warn('Error fetching ingredients:', ingredientsError);
        // Don't fail completely if ingredients can't be fetched
      }

      const mealWithCreator = {
        ...data,
        creator_username: userProfile?.username || 'Unknown User',
      };

      setMeal(mealWithCreator);
      setIngredients(ingredientsData || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error?.message || 'An unexpected error occurred while fetching meal details';
      setError(errorMessage);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchMealDetails(isRefresh);
        }, delay);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mealId, retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchMealDetails();
  }, [fetchMealDetails]);

  const onRefresh = useCallback(() => {
    fetchMealDetails(true);
  }, [fetchMealDetails]);

  const handleHideMeal = useCallback(async () => {
    if (actionLoading === 'hide' || !meal) return;

    Alert.alert(
      'Hide Meal',
      'Are you sure you want to hide this meal? This action will make it permanently invisible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide Meal',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading('hide');
              
              const { error } = await supabase
                .from('meals')
                .update({ forever_invis: true })
                .eq('id', parseInt(mealId));

              if (error) {
                console.error('Error hiding meal:', error);
                throw new Error('Failed to hide meal');
              }

              // Update local state
              setMeal(prev => prev ? { ...prev, forever_invis: true } : null);
              Alert.alert('Success', 'Meal has been hidden');
            } catch (error: any) {
              console.error('Error:', error);
              Alert.alert('Error', error?.message || 'An unexpected error occurred while hiding the meal');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [actionLoading, meal, mealId]);

  const handleResolveReport = useCallback(async () => {
    if (!reportId || actionLoading === 'resolve') return;
    
    try {
      setActionLoading('resolve');
      
      const { error } = await supabase
        .from('reports')
        .update({ status: 'Resolved' })
        .eq('report_id', parseInt(reportId));

      if (error) {
        console.error('Error resolving report:', error);
        throw new Error('Failed to resolve report');
      }

      Alert.alert('Success', 'Report has been resolved', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while resolving the report');
    } finally {
      setActionLoading(null);
    }
  }, [reportId, actionLoading]);

  const handleDismissReport = useCallback(async () => {
    if (!reportId || actionLoading === 'dismiss') return;
    
    try {
      setActionLoading('dismiss');
      
      const { error } = await supabase
        .from('reports')
        .update({ status: 'Dismissed' })
        .eq('report_id', parseInt(reportId));

      if (error) {
        console.error('Error dismissing report:', error);
        throw new Error('Failed to dismiss report');
      }

      Alert.alert('Success', 'Report has been dismissed', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while dismissing the report');
    } finally {
      setActionLoading(null);
    }
  }, [reportId, actionLoading]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Admin Meal Review
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading meal details...
          </Text>
        </View>
      </View>
    );
  }

  if (error && !meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Admin Meal Review
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.centered}>
          <View style={[styles.errorCard, { backgroundColor: theme.card }]}>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={48} color={theme.danger} />
              <Text style={[styles.errorTitle, { color: theme.text }]}>
                Failed to Load Meal
              </Text>
              <Text style={[styles.errorText, { color: theme.subtext }]}>
                {error}
              </Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={16} color={theme.buttonText} />
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Admin Meal Review
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.centered}>
          <View style={[styles.errorCard, { backgroundColor: theme.card }]}>
            <View style={styles.errorContent}>
              <Ionicons name="search" size={48} color={theme.subtext} />
              <Text style={[styles.errorTitle, { color: theme.text }]}>
                Meal Not Found
              </Text>
              <Text style={[styles.errorText, { color: theme.subtext }]}>
                The requested meal could not be found or may have been deleted.
              </Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={16} color={theme.buttonText} />
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.card }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Admin Meal Review
        </Text>
        <TouchableOpacity
          style={[styles.headerActionButton, { backgroundColor: theme.card }]}
          onPress={() => fetchMealDetails()}
        >
          <Ionicons name="refresh" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="alert-circle" size={16} color={theme.danger} />
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
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <ActivityIndicator size="small" color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retrying... (Attempt {retryCount}/3)
          </Text>
        </View>
      )}

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        scrollEventThrottle={16}
      >
        {/* Status Card */}
        {(meal.forever_invis || !meal.visibility) && (
          <View style={[styles.statusCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark" size={20} color={theme.warning} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Meal Status
              </Text>
            </View>
            <View style={styles.statusContainer}>
              {meal.forever_invis && (
                <View style={[styles.statusBadge, { backgroundColor: theme.danger }]}>
                  <Ionicons name="eye-off" size={12} color="white" />
                  <Text style={styles.statusBadgeText}>HIDDEN</Text>
                </View>
              )}
              {!meal.visibility && (
                <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
                  <Ionicons name="lock-closed" size={12} color="white" />
                  <Text style={styles.statusBadgeText}>PRIVATE</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Meal Image Card */}
        {meal.picture && (
          <View style={[styles.imageCard, { backgroundColor: theme.card }]}>
            <Image source={{ uri: meal.picture }} style={styles.mealImage} />
            {meal.created_by_ai && (
              <View style={[styles.aiTag, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="sparkles" size={12} color="white" />
                <Text style={styles.aiTagText}>AI Generated</Text>
              </View>
            )}
          </View>
        )}

        {/* Basic Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Meal Information
            </Text>
          </View>
          <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={14} color={theme.subtext} />
            <Text style={[styles.creatorInfo, { color: theme.subtext }]}>
              Created by: {meal.creator_username}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={14} color={theme.subtext} />
            <Text style={[styles.creatorInfo, { color: theme.subtext }]}>
              Created: {new Date(meal.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Description Card */}
        {meal.description && (
          <View style={[styles.descriptionCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Description
              </Text>
            </View>
            <Text style={[styles.description, { color: theme.text }]}>
              {meal.description}
            </Text>
          </View>
        )}

        {/* Nutrition Card */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="fitness" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Nutrition Information
            </Text>
          </View>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Ionicons name="flame" size={16} color="#FF6B6B" />
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Calories</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {meal.calories || 'N/A'}
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Ionicons name="fitness" size={16} color="#4ECDC4" />
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Protein</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {meal.protein || 'N/A'}g
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Ionicons name="leaf" size={16} color="#45B7D1" />
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Carbs</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {meal.carbohydrates || 'N/A'}g
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Ionicons name="water" size={16} color="#F7DC6F" />
              <Text style={[styles.nutritionLabel, { color: theme.subtext }]}>Fat</Text>
              <Text style={[styles.nutritionValue, { color: theme.text }]}>
                {meal.fat || 'N/A'}g
              </Text>
            </View>
          </View>
        </View>

        {/* Edamam Attribution - Only show when nutrition is calculated with Edamam (not AI) */}
        {meal.Edamam_macros && (
          <View style={styles.attributionContainer}>
            <Image 
              source={require("../../../assets/images/Edamam_Badge_Transparent.png")}
              style={styles.attributionBadge}
              resizeMode="contain"
            />
            <Text style={[styles.attributionText, { color: theme.textSecondary }]}>
              Nutrition data powered by Edamam
            </Text>
          </View>
        )}

        {/* Additional Info Card */}
        <View style={[styles.additionalCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Additional Information
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people" size={14} color={theme.subtext} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              Servings: {meal.servings || 1}
            </Text>
          </View>
          {meal.cuisine && (
            <View style={styles.infoRow}>
              <Ionicons name="earth" size={14} color={theme.subtext} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                Cuisine: {meal.cuisine}
              </Text>
            </View>
          )}
          {meal.dietary_restrictions && (
            <View style={styles.infoRow}>
              <Ionicons name="leaf" size={14} color={theme.subtext} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                Dietary: {meal.dietary_restrictions}
              </Text>
            </View>
          )}
        </View>

        {/* Ingredients Card */}
        {ingredients.length > 0 && (
          <View style={[styles.ingredientsCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="nutrition" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Ingredients ({ingredients.length})
              </Text>
            </View>
            {ingredients.map((ingredient, index) => (
              <View key={ingredient.meal_ingredient_id} style={styles.ingredientItem}>
                <View style={styles.ingredientBullet}>
                  <Text style={[styles.bulletText, { color: theme.primary }]}>•</Text>
                </View>
                <Text style={[styles.ingredientText, { color: theme.text }]}>
                  {ingredient.quantity && ingredient.unit 
                    ? `${ingredient.quantity} ${ingredient.unit} `
                    : ingredient.quantity 
                    ? `${ingredient.quantity} `
                    : ''
                  }
                  {ingredient.raw_name || `Food ID: ${ingredient.food_id}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions Card */}
        {meal.instructions && (
          <View style={[styles.instructionsCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="book" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Instructions
              </Text>
            </View>
            <Text style={[styles.instructions, { color: theme.text }]}>
              {meal.instructions}
            </Text>
          </View>
        )}

        {/* Recipe Link Card */}
        {meal.recipeLink && (
          <View style={[styles.linkCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="link" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Recipe Link
              </Text>
            </View>
            <TouchableOpacity style={styles.linkContainer}>
              <Ionicons name="open" size={16} color={theme.primary} />
              <Text style={[styles.link, { color: theme.primary }]}>
                {meal.recipeLink}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.hideButton,
            { opacity: (meal.forever_invis || actionLoading) ? 0.6 : 1 }
          ]}
          onPress={handleHideMeal}
          disabled={meal.forever_invis || actionLoading === 'hide'}
        >
          <Ionicons name="eye-off" size={16} color="white" />
          {actionLoading === 'hide' ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.actionButtonText}>
              {meal.forever_invis ? 'Hidden' : 'Hide Meal'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.dismissButton,
            { opacity: actionLoading ? 0.6 : 1 }
          ]}
          onPress={handleDismissReport}
          disabled={actionLoading === 'dismiss'}
        >
          <Ionicons name="close" size={16} color="white" />
          {actionLoading === 'dismiss' ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.actionButtonText}>Dismiss</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.resolveButton,
            { opacity: actionLoading ? 0.6 : 1 }
          ]}
          onPress={handleResolveReport}
          disabled={actionLoading === 'resolve'}
        >
          <Ionicons name="checkmark" size={16} color="white" />
          {actionLoading === 'resolve' ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.actionButtonText}>Resolve</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    width: 40,
    height: 40,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  
  // Card Styles
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  imageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mealImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  aiTag: {
    position: 'absolute',
    top: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  aiTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mealName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  creatorInfo: {
    fontSize: 14,
  },

  descriptionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },

  nutritionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
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
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  additionalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },

  ingredientsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ingredientBullet: {
    width: 20,
    alignItems: 'center',
  },
  bulletText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ingredientText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  instructionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  instructions: {
    fontSize: 14,
    lineHeight: 20,
  },

  linkCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  link: {
    fontSize: 14,
    textDecorationLine: 'underline',
    flex: 1,
  },

  // Action Buttons
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  hideButton: {
    backgroundColor: '#DC3545',
  },
  dismissButton: {
    backgroundColor: '#FFC107',
  },
  resolveButton: {
    backgroundColor: '#28A745',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 300,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  errorContent: {
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Legacy styles (keeping for compatibility)
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  attributionContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  attributionBadge: {
    width: 100,
    height: 35,
    marginBottom: 6,
  },
  attributionText: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default AdminMealDetailsScreen;
