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
} from "react-native";
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
        {/* Error Banner */}
        {error && (
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
        {retryCount > 0 && (
          <View style={[styles.retryBanner, { 
            backgroundColor: `${theme.warning}15`, 
            borderColor: theme.warning 
          }]}>
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
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
      {retryCount > 0 && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.primary }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text }]}>Your Meals</Text>

      <FlatList
        data={meals}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={({ item }) => {
          if (!item.id) {
            console.warn("Invalid meal object:", item);
            return null;
          }
          return (
            <View style={[styles.mealContainer, { backgroundColor: theme.card }]}>
              <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => handleAddMeal(item.id)}
                disabled={addingMeal}
              >
                <Text style={[styles.addButtonText, { color: theme.buttonText }]}>
                  {addingMeal ? "Adding..." : "Add to Competition"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              You have no meals to add to the competition.
            </Text>
            {!error && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={handleRetry}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Refresh
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
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
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
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
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
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
  mealName: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
});

export default AddMeal;
