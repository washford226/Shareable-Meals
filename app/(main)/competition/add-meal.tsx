import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../utils/supabase';

interface UserMeal {
  id: number;
  name: string;
  description?: string;
  meal_picture_url?: string;
  cooking_time?: number;
  servings?: number;
  created_at: string;
  user_id: string;
  created_by_ai?: boolean;
  "Edamam_macros"?: boolean;
  already_submitted?: boolean;
}

interface Competition {
  competition_id: number;
  start_date: string;
  end_date: string;
  theme_id?: number;
  created_at: string;
  theme?: {
    theme_id: number;
    theme_name: string;
    description?: string;
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
    fontSize: theme.fonts.title2,
    fontFamily: theme.fontFamily.bold,
    color: theme.text,
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
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.bold,
    color: theme.text,
    marginBottom: 5,
  },
  competitionTheme: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    color: theme.accent,
    marginBottom: 5,
  },
  competitionDates: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
  },
  inactiveBadge: {
    backgroundColor: theme.textSecondary,
  },
  statusText: {
    color: '#ffffff',
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.bold,
    marginLeft: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    color: theme.text,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.bold,
    color: theme.text,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#ffffff',
    fontFamily: theme.fontFamily.bold,
    marginLeft: 5,
    fontSize: theme.fonts.subheadline,
  },
  mealItem: {
    backgroundColor: theme.card,
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedMeal: {
    borderColor: theme.accent,
    borderWidth: 2,
  },
  submittedMeal: {
    opacity: 0.6,
    borderColor: theme.textSecondary,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mealTitleSection: {
    flex: 1,
    marginRight: 10,
  },
  mealName: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.bold,
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
    fontFamily: theme.fontFamily.bold,
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
    fontFamily: theme.fontFamily.bold,
  },
  mealDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
    marginTop: 5,
  },
  mealDetails: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  mealDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  mealDetailText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
    marginLeft: 3,
  },
  submittedBadge: {
    backgroundColor: theme.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  submittedBadgeText: {
    color: '#ffffff',
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.bold,
  },
  selectedIndicator: {
    backgroundColor: theme.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  selectedIndicatorText: {
    color: '#ffffff',
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.bold,
  },
  submitButton: {
    backgroundColor: theme.accent,
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: theme.fonts.body,
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
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  noCompetitionContainer: {
    backgroundColor: theme.card,
    margin: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  noCompetitionText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default function AddMealToCompetitionPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMeals, setUserMeals] = useState<UserMeal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<UserMeal[]>([]);
  const [currentCompetition, setCurrentCompetition] = useState<Competition | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<UserMeal | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterMeals();
  }, [searchQuery, userMeals]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCurrentCompetition(),
        loadUserMeals()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentCompetition = async () => {
    try {
      const { data: competition, error } = await supabase
        .from('weekly_competitions')
        .select(`
          *,
          theme:competition_themes(theme_id, theme_name, description)
        `)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .lte('start_date', new Date().toISOString().split('T')[0])
        .single();

      if (error) {
        console.log('No active competition found');
        setCurrentCompetition(null);
        return;
      }

      setCurrentCompetition(competition);
    } catch (error) {
      console.error('Error loading competition:', error);
    }
  };

  const loadUserMeals = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace('/login');
        return;
      }

      const { data: meals, error } = await supabase
        .from('meals')
        .select('*, created_by_ai, "Edamam_macros"')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (meals && currentCompetition) {
        // Check which meals are already submitted to the current competition
        const { data: submissions } = await supabase
          .from('competition_submissions')
          .select('meal_id')
          .eq('competition_id', currentCompetition.competition_id)
          .eq('user_id', userData.user.id);

        const submittedMealIds = new Set(submissions?.map(s => s.meal_id) || []);

        const mealsWithSubmissionStatus = meals.map(meal => ({
          ...meal,
          already_submitted: submittedMealIds.has(meal.id)
        }));

        setUserMeals(mealsWithSubmissionStatus);
      } else {
        setUserMeals(meals || []);
      }
    } catch (error) {
      console.error('Error loading user meals:', error);
    }
  };

  const filterMeals = () => {
    if (!searchQuery.trim()) {
      setFilteredMeals(userMeals);
      return;
    }

    const filtered = userMeals.filter(meal =>
      meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meal.description && meal.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    setFilteredMeals(filtered);
  };

  const handleMealSelect = (meal: UserMeal) => {
    if (meal.already_submitted) {
      Alert.alert(
        'Already Submitted',
        'This meal has already been submitted to the current competition.'
      );
      return;
    }
    setSelectedMeal(meal);
  };

  const handleSubmitMeal = async () => {
    if (!selectedMeal || !currentCompetition) return;

    Alert.alert(
      'Submit Meal',
      `Are you sure you want to submit "${selectedMeal.name}" to the current competition?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: submitMeal, style: 'default' }
      ]
    );
  };

  const submitMeal = async () => {
    if (!selectedMeal || !currentCompetition) return;

    try {
      setSubmitting(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace('/login');
        return;
      }

      // Check if meal is already submitted (double-check)
      const { data: existingSubmission } = await supabase
        .from('competition_submissions')
        .select('id')
        .eq('competition_id', currentCompetition.competition_id)
        .eq('meal_id', selectedMeal.id)
        .eq('user_id', userData.user.id)
        .single();

      if (existingSubmission) {
        Alert.alert('Error', 'This meal has already been submitted to this competition.');
        return;
      }

      // Submit the meal
      const { error } = await supabase
        .from('competition_submissions')
        .insert([
          {
            competition_id: currentCompetition.competition_id,
            meal_id: selectedMeal.id,
            user_id: userData.user.id,
            submitted_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      Alert.alert(
        'Success!',
        'Your meal has been submitted to the competition.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error submitting meal:', error);
      Alert.alert('Error', 'Failed to submit meal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewMeal = () => {
    router.push('/(main)/my-meals/create' as any);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isCompetitionActive = (competition: Competition) => {
    const now = new Date();
    const start = new Date(competition.start_date);
    const end = new Date(competition.end_date);
    return now >= start && now <= end;
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
          <Text style={styles.headerTitle}>Submit Meal</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCompetition) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Submit Meal</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.noCompetitionContainer}>
          <Ionicons name="calendar-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.noCompetitionText}>
            No active competition at the moment. Check back later!
          </Text>
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
        <Text style={styles.headerTitle}>Submit Meal</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.competitionInfo}>
          <Text style={styles.competitionTitle}>
            Theme: {currentCompetition.theme?.theme_name || 'No theme'}
          </Text>
          {currentCompetition.theme?.description && (
            <Text style={styles.competitionDates}>
              {currentCompetition.theme.description}
            </Text>
          )}
          <Text style={styles.competitionDates}>
            {formatDate(currentCompetition.start_date)} - {formatDate(currentCompetition.end_date)}
          </Text>
          <View 
            style={[
              styles.statusBadge, 
              isCompetitionActive(currentCompetition) ? styles.activeBadge : styles.inactiveBadge
            ]}
          >
            <Ionicons 
              name={isCompetitionActive(currentCompetition) ? "play-circle" : "pause-circle"} 
              size={12} 
              color="#ffffff" 
            />
            <Text style={styles.statusText}>
              {isCompetitionActive(currentCompetition) ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your meals..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Meals</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateNewMeal}>
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.createButtonText}>Create New</Text>
          </TouchableOpacity>
        </View>

        {filteredMeals.length > 0 ? (
          filteredMeals.map((meal) => (
            <TouchableOpacity
              key={meal.id}
              style={[
                styles.mealItem,
                selectedMeal?.id === meal.id && styles.selectedMeal,
                meal.already_submitted && styles.submittedMeal
              ]}
              onPress={() => handleMealSelect(meal)}
              disabled={meal.already_submitted}
            >
              <View style={styles.mealHeader}>
                <View style={styles.mealTitleSection}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <View style={styles.badgeContainer}>
                    {meal.created_by_ai && (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                    {meal["Edamam_macros"] && (
                      <View style={styles.edamamBadge}>
                        <Text style={styles.edamamBadgeText}>Edamam</Text>
                      </View>
                    )}
                  </View>
                </View>
                {meal.already_submitted ? (
                  <View style={styles.submittedBadge}>
                    <Text style={styles.submittedBadgeText}>Submitted</Text>
                  </View>
                ) : selectedMeal?.id === meal.id ? (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedIndicatorText}>Selected</Text>
                  </View>
                ) : null}
              </View>
              
              {meal.description && (
                <Text style={styles.mealDescription} numberOfLines={2}>
                  {meal.description}
                </Text>
              )}
              
              <View style={styles.mealDetails}>
                {meal.cooking_time && (
                  <View style={styles.mealDetail}>
                    <Ionicons name="time" size={12} color={theme.textSecondary} />
                    <Text style={styles.mealDetailText}>{meal.cooking_time} min</Text>
                  </View>
                )}
                {meal.servings && (
                  <View style={styles.mealDetail}>
                    <Ionicons name="people" size={12} color={theme.textSecondary} />
                    <Text style={styles.mealDetailText}>{meal.servings} servings</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'No meals found matching your search'
                : 'You haven\'t created any meals yet. Create your first meal to participate in competitions!'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {selectedMeal && isCompetitionActive(currentCompetition) && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            submitting && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitMeal}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Selected Meal'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}