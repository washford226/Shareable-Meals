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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const CurrentMeals = () => {
  interface Meal {
    meal_id: number;
    name: string;
    votes: number;
    user_id: string;
    username?: string;
  }

  interface Competition {
    competition_id: number;
    start_date: string;
    end_date: string;
    theme_name: string;
    status: string;
  }

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [competitionTheme, setCompetitionTheme] = useState<string | null>(null);
  const [competitionStatus, setCompetitionStatus] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const { theme } = useTheme();

  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: wait 1s, 2s, 4s, etc.
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
    
    setTimeout(() => {
      fetchLatestCompetition();
    }, delay);
  }, [retryCount]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRetryCount(0);
    setError(null);
    fetchLatestCompetition();
  }, []);

  // Fetch the latest competition from Supabase
  const fetchLatestCompetition = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error } = await supabase
        .from("weekly_competitions")
        .select(`
          competition_id,
          start_date,
          end_date,
          status,
          competition_themes!fk_theme_id (
            theme_name
          )
        `)
        .eq("status", "active")
        .order("competition_id", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // If no active competition, try to get the latest one
        const { data: latestData, error: latestError } = await supabase
          .from("weekly_competitions")
          .select(`
            competition_id,
            start_date,
            end_date,
            status,
            competition_themes!fk_theme_id (
              theme_name
            )
          `)
          .order("competition_id", { ascending: false })
          .limit(1)
          .single();

        if (latestError || !latestData) {
          setError("No competitions available at this time.");
          if (showLoading) {
            setLoading(false);
          }
          setRefreshing(false);
          return;
        }

        setCompetitionId(latestData.competition_id);
        setCompetitionTheme(latestData.competition_themes?.[0]?.theme_name || "Unknown Theme");
        setCompetitionStatus(latestData.status);
        await fetchMeals(latestData.competition_id, showLoading);
        return;
      }

      setCompetitionId(data.competition_id);
      setCompetitionTheme(data.competition_themes?.[0]?.theme_name || "Unknown Theme");
      setCompetitionStatus(data.status);
      await fetchMeals(data.competition_id, showLoading);
      setRetryCount(0);
    } catch (error) {
      console.error("Error fetching competitions:", error);
      setError("Failed to load competitions. Please check your connection and try again.");
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, []);

  // Fetch meals for the given competition from Supabase
  const fetchMeals = async (competitionId: number, showLoading = true) => {
    try {
      const { data, error } = await supabase
        .from("competition_submissions")
        .select(`
          meal_id,
          meals!competition_submissions_meal_id_fkey (
            id,
            name
          ),
          user_profiles!competition_submissions_user_id_fkey (
            id,
            username
          )
        `)
        .eq("competition_id", competitionId);

      if (error) {
        throw error;
      }

      // Process the data to include vote counts
      const mealsWithVotes = await Promise.all(
        (data || []).map(async (submission: any) => {
          const { data: voteData } = await supabase
            .from("meal_votes")
            .select("vote_id")
            .eq("meal_id", submission.meal_id)
            .eq("competition_id", competitionId);

          return {
            meal_id: submission.meal_id,
            name: submission.meals?.name || "Unknown Meal",
            votes: voteData?.length || 0,
            user_id: submission.user_profiles?.id || "",
            username: submission.user_profiles?.username || "Unknown User",
          };
        })
      );

      setMeals(mealsWithVotes);
    } catch (error) {
      console.error("Error fetching meals:", error);
      setError("Failed to load meals. Please try again.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  // Handle voting for a meal
  const handleVote = async (mealId: number) => {
    if (!competitionId) return;

    setVoting(true);
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setVoting(false);
        return;
      }
      const userId = userData.user.id;

      // Check if user has already voted for this meal in this competition
      const { data: existingVote } = await supabase
        .from("meal_votes")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .eq("meal_id", mealId)
        .maybeSingle();

      if (existingVote) {
        Alert.alert("Error", "You have already voted for this meal in this competition.");
        setVoting(false);
        return;
      }

      // Insert vote
      const { error } = await supabase.from("meal_votes").insert([
        {
          competition_id: competitionId,
          meal_id: mealId,
          user_id: userId,
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Your vote has been cast!");
      if (competitionId) {
        fetchMeals(competitionId, false); // Refresh the list to update vote counts
      }
    } catch (error) {
      console.error("Error voting for meal:", error);
      Alert.alert("Error", "Failed to cast your vote. Please try again.");
    } finally {
      setVoting(false);
    }
  };

  useEffect(() => {
    fetchLatestCompetition();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
            onPress={() => router.push("/other-meals/other-meals")}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Competition
          </Text>
          <View style={styles.headerActions} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading competitions...</Text>
            
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

  if (!competitionId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
            onPress={() => router.push("/other-meals/other-meals")}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Competition
          </Text>
          <View style={styles.headerActions} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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

          {/* Empty State Card */}
          <View style={[styles.emptyStateCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trophy-outline" size={24} color={theme.textSecondary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Competition
              </Text>
            </View>
            
            <View style={styles.emptyStateContent}>
              <Ionicons name="calendar-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No Active Competition
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                {error || "There are no active competitions at this time. Check back later!"}
              </Text>
              
              {!error && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={handleRetry}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.buttonText} />
                  <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                    Check Again
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
          style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
          onPress={() => router.push("/other-meals/other-meals")}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Competition
        </Text>
        <TouchableOpacity 
          style={[styles.headerActionButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/competition/add-meal")}
        >
          <Ionicons name="add" size={20} color={theme.buttonText} />
        </TouchableOpacity>
      </View>

      <View style={styles.scrollContainer}>
        {/* Competition Theme Card */}
        {competitionTheme && (
          <View style={[styles.competitionCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trophy" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Weekly Competition
              </Text>
            </View>
            
            <View style={styles.competitionContent}>
              <Text style={[styles.themeText, { color: theme.text }]}>
                {competitionTheme}
              </Text>
              {competitionStatus && (
                <View style={[styles.statusBadge, { 
                  backgroundColor: competitionStatus === 'active' ? theme.success : theme.warning 
                }]}>
                  <Text style={[styles.statusText, { color: theme.buttonText }]}>
                    {competitionStatus.charAt(0).toUpperCase() + competitionStatus.slice(1)}
                  </Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.addMealButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push("/competition/add-meal")}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.buttonText} />
              <Text style={[styles.addMealButtonText, { color: theme.buttonText }]}>
                Submit Your Meal
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Meals List */}
        <FlatList
          data={meals}
          keyExtractor={(item) => item.meal_id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.mealCard, { backgroundColor: theme.card }]}>
              <View style={styles.mealHeader}>
                <View style={styles.mealInfo}>
                  <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
                  <View style={styles.userRow}>
                    <Ionicons name="person-circle-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.mealUser, { color: theme.textSecondary }]}>
                      {item.username}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.voteSection}>
                  <View style={styles.voteCount}>
                    <Ionicons name="heart" size={16} color={theme.primary} />
                    <Text style={[styles.voteText, { color: theme.text }]}>
                      {item.votes}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.voteButton, { 
                      backgroundColor: voting ? theme.border : theme.primary,
                      opacity: voting ? 0.6 : 1
                    }]}
                    onPress={() => handleVote(item.meal_id)}
                    disabled={voting}
                  >
                    {voting ? (
                      <ActivityIndicator size="small" color={theme.buttonText} />
                    ) : (
                      <>
                        <Ionicons name="heart-outline" size={16} color={theme.buttonText} />
                        <Text style={[styles.voteButtonText, { color: theme.buttonText }]}>
                          Vote
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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
              <View style={styles.cardHeader}>
                <Ionicons name="restaurant-outline" size={24} color={theme.textSecondary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  No Meals Yet
                </Text>
              </View>
              
              <View style={styles.emptyStateContent}>
                <Ionicons name="add-circle-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  Be the First!
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                  No meals have been submitted for this competition yet. Submit yours to get started!
                </Text>
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={() => router.push("/competition/add-meal")}
                >
                  <Ionicons name="add" size={16} color={theme.buttonText} />
                  <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                    Add Meal
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
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

  // Card Components
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
  competitionCard: {
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

  // Competition Content
  competitionContent: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  themeText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addMealButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Meal Components
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealUser: {
    fontSize: 13,
  },
  voteSection: {
    alignItems: 'center',
    gap: 8,
  },
  voteCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteText: {
    fontSize: 14,
    fontWeight: '600',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    minWidth: 60,
    justifyContent: 'center',
  },
  voteButtonText: {
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
  competitionInfo: {
    marginBottom: 16,
    alignItems: "center",
  },
  mealContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealVotes: {
    fontSize: 14,
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

export default CurrentMeals;
