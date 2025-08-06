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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const CurrentMeals = () => {
  interface Meal {
    meal_id: number;
    name: string;
    description: string;
    picture?: string;
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    cuisine?: string;
    dietary_restrictions?: string;
    created_by_ai?: boolean;
    servings?: number;
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

  interface Winner {
    winner_id: number;
    competition_id: number;
    meal_id: number;
    user_id: string;
    total_votes: number;
    declared_at: string;
    meal_name: string;
    username: string;
    theme_name: string;
    competition_start_date: string;
    competition_end_date: string;
  }

  const [activeTab, setActiveTab] = useState<'current' | 'winners'>('current');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [competitionTheme, setCompetitionTheme] = useState<string | null>(null);
  const [competitionStatus, setCompetitionStatus] = useState<string | null>(null);
  const [competitionDates, setCompetitionDates] = useState<{start: string, end: string} | null>(null);
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
    if (activeTab === 'current') {
      fetchLatestCompetition();
    } else {
      fetchPastWinners();
    }
  }, [activeTab]);

  // Fetch past winners
  const fetchPastWinners = useCallback(async () => {
    setWinnersLoading(true);
    try {
      const { data, error } = await supabase
        .from("weekly_winners")
        .select(`
          winner_id,
          competition_id,
          meal_id,
          user_id,
          total_votes,
          declared_at,
          meals!weekly_winners_meal_id_fkey (
            name
          ),
          user_profiles!weekly_winners_user_id_fkey (
            username
          ),
          weekly_competitions!weekly_winners_competition_id_fkey (
            start_date,
            end_date,
            theme_id
          )
        `)
        .order("declared_at", { ascending: false });

      if (error) {
        throw error;
      }

      // For each winner, fetch the theme name separately
      const formattedWinners: Winner[] = await Promise.all(
        (data || []).map(async (winner: any) => {
          let themeName = "Unknown Theme";
          
          if (winner.weekly_competitions?.theme_id) {
            const { data: themeData } = await supabase
              .from("competition_themes")
              .select("theme_name")
              .eq("theme_id", winner.weekly_competitions.theme_id)
              .single();
            
            themeName = themeData?.theme_name || "Unknown Theme";
          }

          return {
            winner_id: winner.winner_id,
            competition_id: winner.competition_id,
            meal_id: winner.meal_id,
            user_id: winner.user_id,
            total_votes: winner.total_votes,
            declared_at: winner.declared_at,
            meal_name: winner.meals?.name || "Unknown Meal",
            username: winner.user_profiles?.username || "Unknown User",
            theme_name: themeName,
            competition_start_date: winner.weekly_competitions?.start_date || "",
            competition_end_date: winner.weekly_competitions?.end_date || "",
          };
        })
      );

      setWinners(formattedWinners);
    } catch (error) {
      console.error("Error fetching past winners:", error);
      Alert.alert("Error", "Failed to load past winners. Please try again.");
    } finally {
      setWinnersLoading(false);
      setRefreshing(false);
    }
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
          theme_id
        `)
        .eq("status", "active")
        .order("competition_id", { ascending: false })
        .limit(1)
        .single();

      let competitionData = data;
      
      if (error || !data) {
        // If no active competition, try to get the latest one
        const { data: latestData, error: latestError } = await supabase
          .from("weekly_competitions")
          .select(`
            competition_id,
            start_date,
            end_date,
            status,
            theme_id
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

        competitionData = latestData;
      }

      if (!competitionData) {
        setError("No competitions available at this time.");
        if (showLoading) {
          setLoading(false);
        }
        setRefreshing(false);
        return;
      }

      // Now fetch the theme information separately
      const { data: themeData, error: themeError } = await supabase
        .from("competition_themes")
        .select("theme_name")
        .eq("theme_id", competitionData.theme_id)
        .single();

      setCompetitionId(competitionData.competition_id);
      setCompetitionTheme(themeData?.theme_name || "Unknown Theme");
      setCompetitionStatus(competitionData.status);
      setCompetitionDates({
        start: competitionData.start_date,
        end: competitionData.end_date
      });
      await fetchMeals(competitionData.competition_id, showLoading);
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
            name,
            description,
            picture,
            calories,
            protein,
            carbohydrates,
            fat,
            cuisine,
            dietary_restrictions,
            created_by_ai,
            servings
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
            description: submission.meals?.description || "",
            picture: submission.meals?.picture || undefined,
            calories: submission.meals?.calories || undefined,
            protein: submission.meals?.protein || undefined,
            carbohydrates: submission.meals?.carbohydrates || undefined,
            fat: submission.meals?.fat || undefined,
            cuisine: submission.meals?.cuisine || undefined,
            dietary_restrictions: submission.meals?.dietary_restrictions || undefined,
            created_by_ai: submission.meals?.created_by_ai || false,
            servings: submission.meals?.servings || undefined,
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

  useEffect(() => {
    if (activeTab === 'winners') {
      fetchPastWinners();
    }
  }, [activeTab, fetchPastWinners]);

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to get time remaining for active competitions
  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Ended";
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return "Ending soon";
  };

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
        {activeTab === 'current' && (
          <TouchableOpacity 
            style={[styles.headerActionButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/competition/add-meal")}
          >
            <Ionicons name="add" size={20} color={theme.buttonText} />
          </TouchableOpacity>
        )}
        {activeTab === 'winners' && (
          <View style={styles.headerActions} />
        )}
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'current' && { backgroundColor: theme.primary }
          ]}
          onPress={() => setActiveTab('current')}
        >
          <Ionicons 
            name={activeTab === 'current' ? "trophy" : "trophy-outline"} 
            size={20} 
            color={activeTab === 'current' ? theme.buttonText : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'current' ? theme.buttonText : theme.textSecondary }
          ]}>
            Current
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'winners' && { backgroundColor: theme.primary }
          ]}
          onPress={() => setActiveTab('winners')}
        >
          <Ionicons 
            name={activeTab === 'winners' ? "medal" : "medal-outline"} 
            size={20} 
            color={activeTab === 'winners' ? theme.buttonText : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'winners' ? theme.buttonText : theme.textSecondary }
          ]}>
            Winners
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'current' ? renderCurrentCompetition() : renderPastWinners()}
    </View>
  );

  function renderCurrentCompetition() {
    if (loading) {
      return (
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
      );
    }

    if (!competitionId) {
      return (
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
      );
    }

    return (
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
              
              <View style={styles.competitionMeta}>
                {competitionStatus && (
                  <View style={[styles.statusBadge, { 
                    backgroundColor: competitionStatus === 'active' ? theme.success : theme.warning 
                  }]}>
                    <Text style={[styles.statusText, { color: theme.buttonText }]}>
                      {competitionStatus ? competitionStatus.charAt(0).toUpperCase() + competitionStatus.slice(1) : ''}
                    </Text>
                  </View>
                )}
                
                {competitionDates && competitionStatus === 'active' && (
                  <View style={[styles.timeRemainingBadge, { backgroundColor: `${theme.primary}20` }]}>
                    <Ionicons name="time-outline" size={14} color={theme.primary} />
                    <Text style={[styles.timeRemainingText, { color: theme.primary }]}>
                      {getTimeRemaining(competitionDates.end)}
                    </Text>
                  </View>
                )}
              </View>

              {competitionDates && (
                <Text style={[styles.dateRangeText, { color: theme.textSecondary }]}>
                  {formatDate(competitionDates.start)} - {formatDate(competitionDates.end)}
                </Text>
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
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.mealItem, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/(app)/competition/${item.meal_id}/meal-info` as any)}
              activeOpacity={0.7}
            >
              {/* Vote Count Badge */}
              <TouchableOpacity
                style={styles.voteIcon}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent triggering the card navigation
                  handleVote(item.meal_id);
                }}
                disabled={voting}
              >
                {voting ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="heart"
                      size={24}
                      color={theme.primary}
                    />
                    <Text style={[styles.voteCount, { color: theme.primary }]}>
                      {item.votes}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* AI Tag */}
              {item.created_by_ai === true && (
                <View style={[styles.aiTag, { backgroundColor: theme.aiAccent }]}>
                  <Ionicons name="sparkles" size={12} color={theme.buttonText} />
                  <Text style={[styles.aiTagText, { color: theme.buttonText }]}>AI</Text>
                </View>
              )}

              {/* Meal Image */}
              {item.picture && typeof item.picture === "string" ? (
                <Image 
                  source={{ 
                    uri: item.picture.startsWith('\\x') 
                      ? item.picture.slice(2).match(/.{2}/g)?.map((hex: string) => String.fromCharCode(parseInt(hex, 16))).join('') || ''
                      : item.picture 
                  }} 
                  style={styles.mealPicture} 
                />
              ) : (
                <View style={[styles.mealPicturePlaceholder, { backgroundColor: theme.cardSecondary }]}>
                  <Ionicons name="image-outline" size={32} color={theme.subtext} />
                  <Text style={[styles.mealPicturePlaceholderText, { color: theme.subtext }]}>
                    No Image
                  </Text>
                </View>
              )}

              {/* Meal Info */}
              <View style={styles.mealInfo}>
                <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={[styles.mealDescription, { color: theme.subtext }]} numberOfLines={3}>
                  {item.description.length > 80
                    ? `${item.description.slice(0, 80)}...`
                    : item.description}
                </Text>
                
                {/* Nutrition Preview */}
                <View style={styles.nutritionPreview}>
                  <View style={styles.nutritionItem}>
                    <Ionicons name="flame-outline" size={14} color={theme.warning} />
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.calories}
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Ionicons name="barbell-outline" size={14} color={theme.protein} />
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.protein}g
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Ionicons name="analytics-outline" size={14} color={theme.carbs} />
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.carbohydrates}g
                    </Text>
                  </View>
                </View>

                {/* User Row */}
                <View style={styles.userRow}>
                  <Ionicons name="person-circle" size={14} color={theme.subtext} />
                  <Text style={[styles.userName, { color: theme.subtext }]} numberOfLines={1}>
                    {item.username}
                  </Text>
                </View>

                {/* Tags */}
                {(item.dietary_restrictions || item.cuisine) && (
                  <View style={styles.tagsContainer}>
                    {item.dietary_restrictions && (
                      <View style={[styles.tag, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
                        <Text style={[styles.tagText, { color: theme.success }]}>
                          {item.dietary_restrictions}
                        </Text>
                      </View>
                    )}
                    {item.cuisine && (
                      <View style={[styles.tag, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                        <Text style={[styles.tagText, { color: theme.primary }]}>
                          {item.cuisine}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
          contentContainerStyle={styles.mealsGrid}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  function renderPastWinners() {
    if (winnersLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading past winners...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={winners}
        keyExtractor={(item) => item.winner_id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.winnerCard, { backgroundColor: theme.card }]}
            onPress={() => router.push(`/(app)/competition/${item.meal_id}/meal-info` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.winnerHeader}>
              <View style={styles.winnerBadge}>
                <Ionicons name="medal" size={20} color="#FFD700" />
                <Text style={[styles.winnerBadgeText, { color: theme.text }]}>
                  Winner
                </Text>
              </View>
              <Text style={[styles.winnerDate, { color: theme.textSecondary }]}>
                {formatDate(item.declared_at)}
              </Text>
            </View>
            
            <View style={styles.winnerContent}>
              <Text style={[styles.winnerTheme, { color: theme.primary }]}>
                {item.theme_name}
              </Text>
              <Text style={[styles.winnerMealName, { color: theme.text }]}>
                {item.meal_name}
              </Text>
              <View style={styles.winnerUserRow}>
                <Ionicons name="person-circle-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.winnerUsername, { color: theme.textSecondary }]}>
                  {item.username}
                </Text>
              </View>
            </View>
            
            <View style={styles.winnerStats}>
              <View style={styles.winnerVotes}>
                <Ionicons name="heart" size={16} color={theme.primary} />
                <Text style={[styles.winnerVotesText, { color: theme.text }]}>
                  {item.total_votes} votes
                </Text>
              </View>
              <Text style={[styles.competitionDates, { color: theme.textSecondary }]}>
                {formatDate(item.competition_start_date)} - {formatDate(item.competition_end_date)}
              </Text>
            </View>
          </TouchableOpacity>
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
              <Ionicons name="medal-outline" size={24} color={theme.textSecondary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                No Winners Yet
              </Text>
            </View>
            
            <View style={styles.emptyStateContent}>
              <Ionicons name="trophy-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Coming Soon
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                No competitions have been completed yet. Check back after the first competition ends!
              </Text>
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }
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
    flex: 1,
    margin: 6,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
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
    padding: 12,
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

  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Competition-specific styles
  competitionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  timeRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeRemainingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateRangeText: {
    fontSize: 12,
    marginTop: 4,
  },

  // Winner card styles
  winnerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  winnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD70020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  winnerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  winnerDate: {
    fontSize: 12,
  },
  winnerContent: {
    marginBottom: 12,
  },
  winnerTheme: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  winnerMealName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  winnerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  winnerUsername: {
    fontSize: 14,
  },
  winnerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  winnerVotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  winnerVotesText: {
    fontSize: 14,
    fontWeight: '500',
  },
  competitionDates: {
    fontSize: 12,
  },

  // New meal card styles for grid layout (matching meals.tsx)
  mealItem: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    maxWidth: '46%',
  },
  voteIcon: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  mealPicture: {
    width: "100%",
    height: 140,
    resizeMode: 'cover',
  },
  mealPicturePlaceholder: {
    width: "100%",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mealPicturePlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nutritionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  nutritionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mealsGrid: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
    marginBottom: 12,
  },
  mealImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  aiTag: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  voteBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  voteBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  mealDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500',
  },
  nutritionInfo: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nutritionValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  nutritionLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  userName: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default CurrentMeals;
