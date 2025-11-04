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

interface Competition {
  competition_id: number;
  theme_id: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  theme?: {
    theme_name: string;
    description?: string;
  };
}

interface CompetitionSubmission {
  id: number;
  competition_id: number;
  meal_id: number;
  user_id: string;
  submitted_at: string;
  vote_count?: number;
  meal: {
    id: number;
    name: string;
    description?: string;
    meal_picture_url?: string;
    calories?: number;
    created_by_ai?: boolean;
    "Edamam_macros"?: boolean;
  };
  user_profile: {
    id: string;
    username: string;
  };
  user_has_voted?: boolean;
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
  leaderboardButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  competitionCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  competitionTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 8,
  },
  competitionTheme: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.heading,
    marginLeft: 5,
  },
  actionButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
  submissionsSection: {
    padding: 20,
  },
  submissionsTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 15,
  },
  submissionCard: {
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  mealTitleSection: {
    flex: 1,
    marginRight: 10,
  },
  mealName: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
    color: theme.text,
    marginBottom: 5,
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
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
  },
  voteButtonActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  voteButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: theme.accent,
  },
  voteButtonText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.heading,
    marginLeft: 5,
  },
  voteButtonTextActive: {
    color: '#ffffff',
  },
  voteButtonTextInactive: {
    color: theme.accent,
  },
  userInfo: {
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

export default function CurrentCompetitionsPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [submissions, setSubmissions] = useState<CompetitionSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    loadCompetitions();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      
      const { data: competitionsData, error } = await supabase
        .from('weekly_competitions')
        .select(`
          *,
          theme:competition_themes(theme_name, description)
        `)
        .order('start_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (competitionsData) {
        // Add status based on dates
        const processedCompetitions = competitionsData.map(comp => {
          const startDate = new Date(comp.start_date);
          const endDate = new Date(comp.end_date);
          const now = new Date();
          
          let status = 'upcoming';
          if (now >= startDate && now <= endDate) {
            status = 'active';
          } else if (now > endDate) {
            status = 'ended';
          }

          return { ...comp, status };
        });

        setCompetitions(processedCompetitions);

        // Select first active or upcoming competition
        const activeComp = processedCompetitions.find(c => c.status === 'active');
        const upcomingComp = processedCompetitions.find(c => c.status === 'upcoming');
        const defaultComp = activeComp || upcomingComp || processedCompetitions[0];
        
        if (defaultComp) {
          setSelectedCompetition(defaultComp);
          loadSubmissions(defaultComp.competition_id);
        }
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
      Alert.alert('Error', 'Failed to load competitions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (competitionId: number) => {
    try {
      setSubmissionsLoading(true);

      const { data: submissionsData, error } = await supabase
        .from('competition_submissions')
        .select(`
          *,
          meal:meals(id, name, description, meal_picture_url, calories, created_by_ai, "Edamam_macros"),
          user_profile:user_profiles(id, username)
        `)
        .eq('competition_id', competitionId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      if (submissionsData) {
        // Get vote counts for submissions
        const mealIds = submissionsData.map(s => s.meal_id);
        const { data: voteCounts } = await supabase
          .from('meal_votes')
          .select('meal_id')
          .eq('competition_id', competitionId)
          .in('meal_id', mealIds);

        // Count votes per meal
        const voteMap = new Map();
        voteCounts?.forEach(vote => {
          const count = voteMap.get(vote.meal_id) || 0;
          voteMap.set(vote.meal_id, count + 1);
        });

        // Check user votes if logged in
        let userVotedMeals = new Set();
        if (user) {
          const { data: userVotes } = await supabase
            .from('meal_votes')
            .select('meal_id')
            .eq('user_id', user.id)
            .eq('competition_id', competitionId)
            .in('meal_id', mealIds);

          userVotedMeals = new Set(userVotes?.map(v => v.meal_id) || []);
        }

        // Add vote counts and user vote status to submissions
        const submissionsWithVotes = submissionsData.map(sub => ({
          ...sub,
          vote_count: voteMap.get(sub.meal_id) || 0,
          user_has_voted: userVotedMeals.has(sub.meal_id)
        }));

        // Sort by vote count
        submissionsWithVotes.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

        setSubmissions(submissionsWithVotes);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
      Alert.alert('Error', 'Failed to load submissions. Please try again.');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleVote = async (mealId: number) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to vote.');
      return;
    }

    if (!selectedCompetition) return;

    try {
      // Check if already voted
      const { data: existingVote } = await supabase
        .from('meal_votes')
        .select('vote_id')
        .eq('user_id', user.id)
        .eq('meal_id', mealId)
        .eq('competition_id', selectedCompetition.competition_id)
        .single();

      if (existingVote) {
        // Don't allow removing votes
        Alert.alert('Already Voted', 'You have already voted for this meal.');
        return;
      } else {
        // Add vote
        const { error } = await supabase
          .from('meal_votes')
          .insert({
            user_id: user.id,
            meal_id: mealId,
            competition_id: selectedCompetition.competition_id
          });

        if (error) throw error;
        Alert.alert('Vote Cast', 'Your vote has been recorded!');
      }

      // Reload submissions to update vote counts
      loadSubmissions(selectedCompetition.competition_id);
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to process vote. Please try again.');
    }
  };

  const handleSubmitMeal = () => {
    if (!selectedCompetition) return;
    router.push(`./add-meal?competitionId=${selectedCompetition.competition_id}`);
  };

  const handleMealPress = (submission: CompetitionSubmission) => {
    router.push(`/meal-info/competition?mealId=${submission.meal.id}` as any);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'upcoming':
        return '#f59e0b';
      case 'ended':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return 'radio-button-on';
      case 'upcoming':
        return 'time';
      case 'ended':
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
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
          <Text style={styles.headerTitle}>Current Competition</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading competitions...</Text>
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
        <Text style={styles.headerTitle}>Current Competition</Text>
        <TouchableOpacity
          style={styles.leaderboardButton}
          onPress={() => router.push('./leaderboard' as any)}
        >
          <Ionicons name="trophy" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {selectedCompetition ? (
          <>
            <View style={styles.competitionCard}>
              <Text style={styles.competitionTheme}>
                Theme: {selectedCompetition.theme?.theme_name || 'No theme'}
              </Text>
              <View style={styles.statusContainer}>
                <View 
                  style={[
                    styles.statusBadge, 
                    { backgroundColor: getStatusColor(selectedCompetition.status) }
                  ]}
                >
                  <Ionicons 
                    name={getStatusIcon(selectedCompetition.status) as any} 
                    size={12} 
                    color="#ffffff" 
                  />
                  <Text style={styles.statusText}>
                    {selectedCompetition.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              {selectedCompetition.status === 'active' && (
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={handleSubmitMeal}
                >
                  <Text style={styles.actionButtonText}>Submit Your Meal</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.submissionsSection}>
              <Text style={styles.submissionsTitle}>
                Submitted Meals ({submissions.length})
              </Text>

              {submissionsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <Text style={styles.loadingText}>Loading submissions...</Text>
                </View>
              ) : submissions.length > 0 ? (
                submissions.map((submission) => (
                  <TouchableOpacity
                    key={submission.id}
                    style={styles.submissionCard}
                    onPress={() => handleMealPress(submission)}
                  >
                    <View style={styles.submissionHeader}>
                      <View style={styles.mealTitleSection}>
                        <Text style={styles.mealName}>{submission.meal.name}</Text>
                        <View style={styles.badgeContainer}>
                          {submission.meal.created_by_ai && (
                            <View style={styles.aiBadge}>
                              <Text style={styles.aiBadgeText}>AI</Text>
                            </View>
                          )}
                          {submission.meal["Edamam_macros"] && (
                            <View style={styles.edamamBadge}>
                              <Text style={styles.edamamBadgeText}>Edamam</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[
                          styles.voteButton,
                          submission.user_has_voted 
                            ? styles.voteButtonActive 
                            : styles.voteButtonInactive
                        ]}
                        onPress={() => handleVote(submission.meal_id)}
                      >
                        <Ionicons 
                          name={submission.user_has_voted ? "heart" : "heart-outline"} 
                          size={16} 
                          color={submission.user_has_voted ? "#ffffff" : theme.accent} 
                        />
                        <Text 
                          style={[
                            styles.voteButtonText,
                            submission.user_has_voted 
                              ? styles.voteButtonTextActive 
                              : styles.voteButtonTextInactive
                          ]}
                        >
                          {submission.vote_count || 0}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.userInfo}>
                      by {submission.user_profile.username}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
                  <Text style={styles.emptyText}>
                    No meals submitted yet. Be the first to submit!
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>
              No competitions available at the moment
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}