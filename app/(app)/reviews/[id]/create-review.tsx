import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StarRating from "react-native-star-rating-widget";
import { useTheme } from "../../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const CreateReview = () => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const { theme } = useTheme();
  const router = useRouter();
  const { id: mealId, mealName } = useLocalSearchParams<{ id: string; mealName: string }>();

  const handleSubmit = useCallback(async () => {
    if (!mealId) {
      const errorMessage = "Meal ID is missing. Please try again.";
      setError(errorMessage);
      return;
    }

    if (rating < 1 || rating > 5) {
      const errorMessage = "Please select a rating between 1 and 5 stars.";
      setError(errorMessage);
      return;
    }

    if (comment.trim().length > 500) {
      const errorMessage = "Comment must be 500 characters or less.";
      setError(errorMessage);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      // Check if user has already reviewed this meal
      const { data: existingReview, error: checkError } = await supabase
        .from("reviews")
        .select("review_id")
        .eq("meal_id", mealId)
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw checkError;
      }

      if (existingReview) {
        throw new Error("You have already reviewed this meal.");
      }

      const { error } = await supabase.from("reviews").insert([
        {
          meal_id: mealId,
          user_id: userId,
          rating,
          comment: comment.trim(),
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Your review has been submitted!", [
        { text: "OK", onPress: () => router.back() }
      ]);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error submitting review:", error);
      const errorMessage = error.message || "Failed to submit your review. Please try again later.";
      setError(errorMessage);
      
      // Auto-retry logic for network errors only (not validation/auth errors)
      const isRetryableError = !error.message?.includes("already reviewed") && 
                              !error.message?.includes("authenticated") &&
                              !error.message?.includes("does not exist") &&
                              error.code !== "42703" && // PostgreSQL column does not exist
                              retryCount < 2; // Max 3 attempts (0, 1, 2)
      
      if (isRetryableError) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          handleSubmit();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [mealId, rating, comment, retryCount, router]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    handleSubmit();
  }, [handleSubmit]);

  // Clear error when user makes changes
  const handleRatingChange = useCallback((newRating: number) => {
    setRating(newRating);
    if (error) setError(null);
  }, [error]);

  const handleCommentChange = useCallback((text: string) => {
    setComment(text);
    if (error) setError(null);
  }, [error]);

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
          Create Review
        </Text>
        <View style={styles.headerActions} />
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
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
            {!error.includes("already reviewed") && 
             !error.includes("authenticated") && 
             !error.includes("does not exist") &&
             retryCount < 3 && (
              <TouchableOpacity
                style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
                onPress={handleRetry}
              >
                <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}
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

        {/* Meal Info Card */}
        <View style={[styles.mealCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="restaurant-outline" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {mealName || "Meal"}
            </Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Share your experience with this meal
          </Text>
        </View>

        {/* Rating Card */}
        <View style={[styles.ratingCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="star-outline" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Rating</Text>
            <Text style={[styles.requiredLabel, { color: theme.danger }]}>*</Text>
          </View>
          
          <View style={styles.ratingSection}>
            <StarRating
              rating={rating}
              onChange={handleRatingChange}
              maxStars={5}
              starSize={32}
              color={theme.starColor || theme.primary}
              emptyColor={`${theme.text}30`}
            />
            {rating > 0 && (
              <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
                {rating} out of 5 stars
              </Text>
            )}
          </View>
        </View>

        {/* Comment Card */}
        <View style={[styles.commentCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble-outline" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Comment
            </Text>
            <Text style={[styles.optionalLabel, { color: theme.textSecondary }]}>
              (Optional)
            </Text>
          </View>
          
          <View style={styles.commentSection}>
            <View style={styles.commentHeader}>
              <Text style={[styles.characterCount, { color: theme.textSecondary }]}>
                {comment.length}/500 characters
              </Text>
            </View>
            <TextInput
              style={[
                styles.commentInput, 
                { 
                  borderColor: error && comment.length > 500 ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background
                }
              ]}
              placeholder="Share your thoughts about this meal..."
              placeholderTextColor={theme.placeholder}
              multiline
              value={comment}
              onChangeText={handleCommentChange}
              maxLength={500}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.submitButton, 
              styles.primaryButton,
              { 
                backgroundColor: rating > 0 ? theme.primary : theme.border,
                opacity: rating > 0 ? 1 : 0.5
              }
            ]}
            onPress={handleSubmit}
            disabled={loading || rating === 0}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={20} color={theme.buttonText} />
                <Text style={[styles.submitButtonText, { color: theme.buttonText }]}>
                  Submit Review
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.cancelButton, 
              styles.secondaryButton,
              { 
                borderColor: theme.border,
                backgroundColor: theme.card
              }
            ]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons name="close-outline" size={20} color={theme.text} />
            <Text style={[styles.cancelButtonText, { color: theme.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
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
    paddingBottom: 20,
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
  mealCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commentCard: {
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
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  requiredLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  optionalLabel: {
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 4,
  },

  // Rating Section
  ratingSection: {
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },

  // Comment Section
  commentSection: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },

  // Action Buttons
  actionButtons: {
    margin: 16,
    marginTop: 8,
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Legacy styles (keeping for compatibility)
  title: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 24 
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  buttonContainer: { 
    flexDirection: "row", 
    justifyContent: "space-between",
    marginTop: 24,
  },
});

export default CreateReview;