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
        .select("id")
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
      
      // Auto-retry logic for network errors (not validation errors)
      if (!error.message?.includes("already reviewed") && 
          !error.message?.includes("authenticated") && 
          retryCount < 3) {
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
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          {!error.includes("already reviewed") && !error.includes("authenticated") && (
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
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>
        Create Review for {mealName || "Meal"}
      </Text>

      <View style={styles.ratingSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Rating *</Text>
        <StarRating
          rating={rating}
          onChange={handleRatingChange}
          maxStars={5}
          starSize={30}
          color={theme.starColor}
        />
        {rating > 0 && (
          <Text style={[styles.ratingText, { color: theme.subtext }]}>
            {rating} out of 5 stars
          </Text>
        )}
      </View>

      <View style={styles.commentSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>
          Comment (Optional)
        </Text>
        <Text style={[styles.characterCount, { color: theme.subtext }]}>
          {comment.length}/500 characters
        </Text>
        <TextInput
          style={[
            styles.input, 
            styles.commentInput, 
            { 
              borderColor: error && comment.length > 500 ? theme.danger : theme.border, 
              color: theme.text 
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

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton, 
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
            <Text style={[styles.submitButtonText, { color: theme.buttonText }]}>
              Submit Review
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.border }]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16 
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
    marginBottom: 24 
  },
  ratingSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    marginTop: 8,
  },
  commentSection: {
    marginBottom: 24,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  commentInput: { 
    height: 120, 
    textAlignVertical: "top" 
  },
  buttonContainer: { 
    flexDirection: "row", 
    justifyContent: "space-between",
    marginTop: 24,
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  submitButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: { 
    fontSize: 16 
  },
});

export default CreateReview;