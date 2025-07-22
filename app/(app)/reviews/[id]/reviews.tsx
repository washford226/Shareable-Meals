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
} from "react-native";
import StarRating from "react-native-star-rating-widget";
import { useTheme } from "../../../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "utils/supabase";

interface Review {
  id: string;
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
      </View>
    );
  }

  if (reviews.length === 0) {
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
          <Text style={[styles.noReviewsText, { color: theme.text }]}>
            {error || `No reviews available for ${mealName || "this meal"}.`}
          </Text>
          
          {!error && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                Check Again
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
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

      <Text style={[styles.title, { color: theme.text }]}>Reviews for {mealName || "Meal"}</Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.reviewItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {item.userName || "Anonymous"}
            </Text>
            <StarRating
              rating={item.rating}
              maxStars={5}
              starSize={20}
              color={theme.starColor}
              enableSwiping={false}
              onChange={() => {}}
            />
            <Text style={[styles.comment, { color: theme.subtext }]}>{item.comment}</Text>
            <Text style={[styles.date, { color: theme.subtext }]}>
              Reviewed on: {new Date(item.created_at).toLocaleDateString()}
            </Text>
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
      />
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.button }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>
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
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  reviewItem: {
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  comment: {
    fontSize: 14,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 8,
  },
  noReviewsText: {
    fontSize: 16,
    marginTop: 8,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ViewReviews;