import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StarRating from "react-native-star-rating-widget";
import { useTheme } from "../../../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "utils/supabase";

interface Review {
  review_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  userName?: string;
}

const ViewReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { theme } = useTheme();
  const router = useRouter();
  const { id: mealId, mealName } = useLocalSearchParams<{ id: string; mealName: string }>();

  const fetchReviews = useCallback(async (showLoading = true) => {
    if (!mealId) {
      const errorMessage = "Meal ID is missing. Please try again.";
      setError(errorMessage);
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // 1. Fetch reviews for the meal
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select("*")
        .eq("meal_id", mealId)
        .order("created_at", { ascending: false });

      if (reviewsError) throw reviewsError;

      // 2. Fetch all user_profiles for those user_ids
      const userIds = Array.from(new Set((reviewsData || []).map(review => review.user_id)));
      let userIdToUsername: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id,username")
          .in("id", userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach(profile => {
            userIdToUsername[profile.id] = profile.username;
          });
        }
      }

      // 3. Combine reviews and usernames
      const reviewsWithUsernames = (reviewsData || []).map(review => ({
        ...review,
        userName: userIdToUsername[review.user_id] || "Anonymous",
      }));

      setReviews(reviewsWithUsernames);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      const errorMessage = error.message || "Failed to fetch reviews. Please try again later.";
      setError(errorMessage);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchReviews(false);
        }, delay);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [mealId, retryCount]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchReviews(true);
  }, [fetchReviews]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRetryCount(0);
    await fetchReviews(false);
    setRefreshing(false);
  }, [fetchReviews]);

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Reviews
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
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading reviews...</Text>
            
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

  if (reviews.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: `${theme.text}15` }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Reviews
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
              <Ionicons name="chatbubbles-outline" size={24} color={theme.textSecondary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {mealName || "Meal"}
              </Text>
            </View>
            
            <View style={styles.emptyStateContent}>
              <Ionicons name="star-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.noReviewsText, { color: theme.text }]}>
                No reviews yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Be the first to share your thoughts about this meal
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
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Reviews
        </Text>
        <View style={styles.headerActions} />
      </View>

      <View style={styles.scrollContainer}>
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

        {/* Reviews Header Card */}
        <View style={[styles.reviewsHeaderCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubbles" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {mealName || "Meal"}
            </Text>
          </View>
          <Text style={[styles.reviewsCount, { color: theme.textSecondary }]}>
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </Text>
        </View>

        <FlatList
          data={reviews}
          keyExtractor={(item) => item.review_id}
          renderItem={({ item }) => (
            <View style={[styles.reviewCard, { backgroundColor: theme.card }]}>
              <View style={styles.reviewHeader}>
                <View style={styles.userInfo}>
                  <View style={[styles.userAvatar, { backgroundColor: theme.primary }]}>
                    <Ionicons name="person" size={16} color={theme.buttonText} />
                  </View>
                  <Text style={[styles.userName, { color: theme.text }]}>
                    {item.userName || "Anonymous"}
                  </Text>
                </View>
                <Text style={[styles.reviewDate, { color: theme.textSecondary }]}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.ratingContainer}>
                <StarRating
                  rating={item.rating}
                  maxStars={5}
                  starSize={18}
                  color={theme.starColor || theme.primary}
                  enableSwiping={false}
                  onChange={() => {}}
                />
                <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
                  {item.rating}/5
                </Text>
              </View>
              
              {item.comment && (
                <Text style={[styles.reviewComment, { color: theme.text }]}>
                  {item.comment}
                </Text>
              )}
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
  reviewsHeaderCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewCard: {
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
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  reviewsCount: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Empty State
  emptyStateContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
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

  // Review Components
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reviewComment: {
    fontSize: 15,
    lineHeight: 22,
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
  noReviewsText: {
    fontSize: 18,
    fontWeight: '600',
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
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  reviewItem: {
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  comment: {
    fontSize: 14,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ViewReviews;