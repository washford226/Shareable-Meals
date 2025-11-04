import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../utils/supabase';

interface LeaderboardEntry {
  id: number;
  meal_id: number;
  user_id: string;
  competition_id: number;
  submitted_at: string;
  vote_count: number;
  rank: number;
  meal: {
    id: number;
    name: string;
    description?: string;
    meal_picture_url?: string;
    created_by_ai?: boolean;
    "Edamam_macros"?: boolean;
  };
  user_profile: {
    id: string;
    username: string;
  };
}

interface Winner {
  winner_id: number;
  competition_id: number;
  meal_id: number;
  user_id: string;
  total_votes: number;
  declared_at: string;
  notes?: string;
  competition: {
    competition_id: number;
    start_date: string;
    end_date: string;
    theme?: {
      theme_name: string;
      description?: string;
    };
  };
  meal: {
    id: number;
    name: string;
    meal_picture_url?: string;
    created_by_ai?: boolean;
    "Edamam_macros"?: boolean;
  };
  user_profile: {
    id: string;
    username: string;
  };
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    margin: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.accent,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontFamily: theme.fontFamily.heading,
    fontSize: theme.fonts.medium,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabTextInactive: {
    color: theme.text,
  },
  content: {
    flex: 1,
  },
  competitionInfo: {
    backgroundColor: theme.card,
    margin: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  competitionTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 5,
  },
  competitionTheme: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    color: theme.accent,
  },
  leaderboardItem: {
    backgroundColor: theme.card,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    minWidth: 60,
  },
  rankNumber: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    marginLeft: 5,
  },
  mealInfo: {
    flex: 1,
  },
  mealTitleSection: {
    marginBottom: 3,
  },
  mealName: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 3,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  aiBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    color: 'white',
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  edamamBadge: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  edamamBadgeText: {
    color: '#6c757d',
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.body,
  },
  userInfo: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
  },
  voteCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  voteCountText: {
    color: '#ffffff',
    fontFamily: theme.fontFamily.heading,
    marginLeft: 3,
    fontSize: theme.fonts.small,
  },
  winnerItem: {
    backgroundColor: theme.card,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  winnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trophyIcon: {
    marginRight: 10,
  },
  winnerTitleSection: {
    flex: 1,
  },
  winnerMealName: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 3,
  },
  winnerDate: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
  },
  winnerDetails: {
    marginTop: 5,
  },
  winnerCompetition: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    color: theme.accent,
    marginBottom: 3,
  },
  winnerUser: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    color: theme.text,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default function CompetitionLeaderboardPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'historical'>('current');
  const [currentLeaderboard, setCurrentLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [historicalWinners, setHistoricalWinners] = useState<Winner[]>([]);
  const [currentCompetition, setCurrentCompetition] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCurrentLeaderboard(),
        loadHistoricalWinners()
      ]);
    } catch (error) {
      console.error('Error loading leaderboard data:', error);
      Alert.alert('Error', 'Failed to load leaderboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentLeaderboard = async () => {
    try {
      // First get the current active competition
      const { data: activeCompetition, error: compError } = await supabase
        .from('weekly_competitions')
        .select(`
          *,
          theme:competition_themes(theme_name, description)
        `)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .lte('start_date', new Date().toISOString().split('T')[0])
        .single();

      if (compError) {
        console.log('No active competition found');
        setCurrentCompetition(null);
        setCurrentLeaderboard([]);
        return;
      }

      setCurrentCompetition(activeCompetition);

      // Get submissions for the current competition
      const { data: submissionsData, error: subError } = await supabase
        .from('competition_submissions')
        .select(`
          *,
          meal:meals(id, name, description, meal_picture_url, created_by_ai, "Edamam_macros"),
          user_profile:user_profiles(id, username)
        `)
        .eq('competition_id', activeCompetition.competition_id)
        .order('submitted_at', { ascending: false });

      if (subError) throw subError;

      if (submissionsData) {
        // Get vote counts for each submission
        const mealIds = submissionsData.map(s => s.meal_id);
        const { data: voteCounts } = await supabase
          .from('meal_votes')
          .select('meal_id')
          .eq('competition_id', activeCompetition.competition_id)
          .in('meal_id', mealIds);

        // Count votes per meal
        const voteMap = new Map();
        voteCounts?.forEach(vote => {
          const count = voteMap.get(vote.meal_id) || 0;
          voteMap.set(vote.meal_id, count + 1);
        });

        // Add vote counts and calculate ranking
        const leaderboardData = submissionsData.map(sub => ({
          ...sub,
          vote_count: voteMap.get(sub.meal_id) || 0
        }));

        // Sort by vote count and add ranking
        leaderboardData.sort((a, b) => b.vote_count - a.vote_count);
        const rankedData = leaderboardData.map((item, index) => ({
          ...item,
          rank: index + 1
        }));

        setCurrentLeaderboard(rankedData);
      }
    } catch (error) {
      console.error('Error loading current leaderboard:', error);
    }
  };

  const loadHistoricalWinners = async () => {
    try {
      const { data: winnersData, error } = await supabase
        .from('weekly_winners')
        .select(`
          *,
          competition:weekly_competitions(
            competition_id,
            start_date,
            end_date,
            theme:competition_themes(theme_name, description)
          ),
          meal:meals(id, name, meal_picture_url, created_by_ai, "Edamam_macros"),
          user_profile:user_profiles(id, username)
        `)
        .order('declared_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setHistoricalWinners(winnersData || []);
    } catch (error) {
      console.error('Error loading historical winners:', error);
    }
  };

  const handleMealPress = (mealId: number) => {
    router.push(`/meal-info/competition?mealId=${mealId}` as any);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return 'trophy';
      case 2:
        return 'medal';
      case 3:
        return 'medal-outline';
      default:
        return 'ribbon-outline';
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#ffd700'; // Gold
      case 2:
        return '#c0c0c0'; // Silver
      case 3:
        return '#cd7f32'; // Bronze
      default:
        return theme.textSecondary;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            viewMode === 'current' ? styles.tabActive : styles.tabInactive
          ]}
          onPress={() => setViewMode('current')}
        >
          <Text
            style={[
              styles.tabText,
              viewMode === 'current' ? styles.tabTextActive : styles.tabTextInactive
            ]}
          >
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            viewMode === 'historical' ? styles.tabActive : styles.tabInactive
          ]}
          onPress={() => setViewMode('historical')}
        >
          <Text
            style={[
              styles.tabText,
              viewMode === 'historical' ? styles.tabTextActive : styles.tabTextInactive
            ]}
          >
            Winners
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {viewMode === 'current' ? (
          <>
            {currentCompetition && (
              <View style={styles.competitionInfo}>
                <Text style={styles.competitionTitle}>
                  Theme: {currentCompetition.theme?.theme_name || 'No theme'}
                </Text>
              </View>
            )}

            {currentLeaderboard.length > 0 ? (
              currentLeaderboard.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.leaderboardItem}
                  onPress={() => handleMealPress(entry.meal.id)}
                >
                  <View style={styles.leaderboardHeader}>
                    <View style={styles.rankContainer}>
                      <Ionicons
                        name={getRankIcon(entry.rank) as any}
                        size={20}
                        color={getRankColor(entry.rank)}
                      />
                      <Text 
                        style={[
                          styles.rankNumber, 
                          { color: getRankColor(entry.rank) }
                        ]}
                      >
                        #{entry.rank}
                      </Text>
                    </View>
                    <View style={styles.mealInfo}>
                      <View style={styles.mealTitleSection}>
                        <Text style={styles.mealName}>{entry.meal.name}</Text>
                        <View style={styles.badgeContainer}>
                          {entry.meal.created_by_ai && (
                            <View style={styles.aiBadge}>
                              <Text style={styles.aiBadgeText}>AI</Text>
                            </View>
                          )}
                          {entry.meal["Edamam_macros"] && (
                            <View style={styles.edamamBadge}>
                              <Text style={styles.edamamBadgeText}>Edamam</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.userInfo}>
                        by {entry.user_profile.username}
                      </Text>
                    </View>
                    <View style={styles.voteCount}>
                      <Ionicons name="heart" size={12} color="#ffffff" />
                      <Text style={styles.voteCountText}>{entry.vote_count}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={theme.textSecondary} />
                <Text style={styles.emptyText}>
                  {currentCompetition 
                    ? 'No submissions yet for the current competition'
                    : 'No active competition at the moment'
                  }
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {historicalWinners.length > 0 ? (
              historicalWinners.map((winner) => (
                <TouchableOpacity
                  key={winner.winner_id}
                  style={styles.winnerItem}
                  onPress={() => handleMealPress(winner.meal.id)}
                >
                  <View style={styles.winnerHeader}>
                    <Ionicons
                      name="trophy"
                      size={24}
                      color="#ffd700"
                      style={styles.trophyIcon}
                    />
                    <View style={styles.winnerTitleSection}>
                      <Text style={styles.winnerMealName}>{winner.meal.name}</Text>
                      <View style={styles.badgeContainer}>
                        {winner.meal.created_by_ai && (
                          <View style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>AI</Text>
                          </View>
                        )}
                        {winner.meal["Edamam_macros"] && (
                          <View style={styles.edamamBadge}>
                            <Text style={styles.edamamBadgeText}>Edamam</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.winnerDate}>
                      {formatDate(winner.declared_at)}
                    </Text>
                  </View>
                  <View style={styles.winnerDetails}>
                    <Text style={styles.winnerCompetition}>
                      {winner.competition.theme?.theme_name || 'No theme'}
                    </Text>
                    <Text style={styles.winnerUser}>
                      Winner: {winner.user_profile.username} • {winner.total_votes} votes
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={theme.textSecondary} />
                <Text style={styles.emptyText}>
                  No competition winners yet
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}