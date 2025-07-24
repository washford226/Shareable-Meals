import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const AddMeal = () => {
  interface Meal {
    id: number;
    name: string;
    favorite: boolean;
  }

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMeal, setAddingMeal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch user's meals from Supabase
  const fetchUserMeals = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("meals")
        .select("id, name, favorite")
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
      
      setMeals(data || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error fetching user meals:", error);
      const errorMessage = error.message || "Failed to fetch your meals. Please try again later.";
      setError(errorMessage);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchUserMeals(false);
        }, delay);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [retryCount]);

  // Handle adding a meal to the competition
  const handleAddMeal = useCallback(async (mealId: number) => {
    if (addingMeal) return; // Prevent double submission
    
    setAddingMeal(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      // Get the current active competition
      const { data: competitionData, error: competitionError } = await supabase
        .from("weekly_competitions")
        .select("competition_id")
        .eq("status", "active")
        .order("competition_id", { ascending: false })
        .limit(1)
        .single();

      if (competitionError || !competitionData) {
        throw new Error("No active competition found.");
      }

      // Check if user has already submitted this meal to this competition
      const { data: existingSubmission } = await supabase
        .from("competition_submissions")
        .select("id")
        .eq("user_id", userId)
        .eq("competition_id", competitionData.competition_id)
        .eq("meal_id", mealId)
        .maybeSingle();

      if (existingSubmission) {
        throw new Error("You have already submitted this meal to the current competition.");
      }

      // Insert into 'competition_submissions'
      const { error } = await supabase
        .from("competition_submissions")
        .insert([{ 
          meal_id: mealId, 
          user_id: userId, 
          competition_id: competitionData.competition_id 
        }]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Meal added to the competition!", [
        { text: "OK", onPress: () => router.push("/competition/current-meals") }
      ]);
    } catch (error: any) {
      console.error("Error adding meal to competition:", error);
      const errorMessage = error.message || "Failed to add your meal to the competition. Please try again later.";
      Alert.alert("Error", errorMessage);
    } finally {
      setAddingMeal(false);
    }
  }, [addingMeal, router]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchUserMeals(true);
  }, [fetchUserMeals]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRetryCount(0);
    await fetchUserMeals(false);
    setRefreshing(false);
  }, [fetchUserMeals]);

  useEffect(() => {
    fetchUserMeals();
  }, []);

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
            Add to Competition
          </Text>
          <View style={styles.headerActions} />
        </View>

        <ScrollView style={styles.scrollContainer}>
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
          {retryCount > 0 && (
            <View style={[styles.retryBanner, { 
              backgroundColor: `${theme.warning}15`, 
              borderColor: theme.warning 
            }]}>
              <ActivityIndicator size="small" color={theme.warning} />
              <Text style={[styles.retryBannerText, { color: theme.warning }]}>
                Retry attempt {retryCount}/3
              </Text>
            </View>
          )}

          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>
              Loading your meals...
            </Text>
            
            {error && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={handleRetry}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
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
          Add to Competition
        </Text>
        <View style={styles.headerActions} />
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
      {retryCount > 0 && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <ActivityIndicator size="small" color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      {/* Instructions Card */}
      <View style={[styles.instructionsCard, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle" size={20} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Choose Your Meal
          </Text>
        </View>
        <Text style={[styles.instructionsText, { color: theme.subtext }]}>
          Select one of your meals to add to the current weekly competition. Make sure it fits the theme!
        </Text>
      </View>

      <FlatList
        data={meals}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={({ item }) => {
          if (!item.id) {
            console.warn("Invalid meal object:", item);
            return null;
          }
          return (
            <View style={[styles.mealCard, { backgroundColor: theme.card }]}>
              <View style={styles.mealInfo}>
                <View style={styles.mealHeader}>
                  <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
                  {item.favorite && (
                    <Ionicons name="heart" size={16} color={theme.danger} />
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.addButton, 
                  { 
                    backgroundColor: addingMeal ? theme.border : theme.primary,
                    opacity: addingMeal ? 0.6 : 1,
                  }
                ]}
                onPress={() => handleAddMeal(item.id)}
                disabled={addingMeal}
              >
                {addingMeal ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={16} color={theme.buttonText} />
                    <Text style={[styles.addButtonText, { color: theme.buttonText }]}>
                      Add
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={[styles.emptyStateCard, { backgroundColor: theme.card }]}>
            <View style={styles.emptyStateContent}>
              <Ionicons name="restaurant" size={48} color={theme.subtext} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No Meals Found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.subtext }]}>
                You don't have any meals to add to the competition yet. Create some meals first!
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/my-meals/create')}
              >
                <Ionicons name="add" size={16} color={theme.buttonText} />
                <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                  Create Meal
                </Text>
              </TouchableOpacity>
              {!error && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={handleRetry}
                >
                  <Ionicons name="refresh" size={16} color={theme.text} />
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    Refresh
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
      />
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

  // Card Components
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
  mealCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Meal Components
  mealInfo: {
    flex: 1,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    minWidth: 60,
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Content and Layout
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingBottom: 20,
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

  // Legacy styles (keeping for compatibility)
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  mealContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AddMeal;
