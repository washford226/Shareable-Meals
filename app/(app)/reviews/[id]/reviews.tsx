import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import StarRating from "react-native-star-rating-widget";
import { useTheme } from "../../../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "app/utils_supabase";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles?: { username?: string };
}

const ViewReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const { theme } = useTheme();
  const router = useRouter();
  const { id: mealId, mealName } = useLocalSearchParams<{ id: string; mealName: string }>();

  const fetchReviews = async () => {
    if (!mealId) {
      Alert.alert("Error", "Meal ID is missing. Please try again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch reviews and join with profiles for username
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles:user_id(username)")
        .eq("meal_id", mealId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews(data || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      Alert.alert("Error", "Failed to fetch reviews. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading reviews...</Text>
      </View>
    );
  }

  if (reviews.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.noReviewsText, { color: theme.text }]}>
          No reviews available for {mealName || "this meal"}.
        </Text>
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
      <Text style={[styles.title, { color: theme.text }]}>Reviews for {mealName || "Meal"}</Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.reviewItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {item.profiles?.username || "Anonymous"}
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