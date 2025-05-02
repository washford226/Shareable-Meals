import React, { useState } from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import StarRating from "react-native-star-rating-widget";
import { useTheme } from "../../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const CreateReview = () => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const router = useRouter();
  const { id: mealId, mealName } = useLocalSearchParams<{ id: string; mealName: string }>();

  const handleSubmit = async () => {
    if (!mealId) {
      Alert.alert("Error", "Meal ID is missing. Please try again.");
      return;
    }

    if (rating < 1 || rating > 5) {
      Alert.alert("Invalid Rating", "Please select a rating between 1 and 5 stars.");
      return;
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      await axios.post(
        `${BASE_URL}/reviews`,
        {
          meal_id: mealId,
          rating,
          comment,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert("Success", "Your review has been submitted!");
      router.back(); // Navigate back after submission
    } catch (error) {
      console.error("Error submitting review:", error);
      Alert.alert("Error", "Failed to submit your review. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Create Review for {mealName || "Meal"}
      </Text>

      <StarRating
        rating={rating}
        onChange={setRating}
        maxStars={5}
        starSize={30}
        color={theme.starColor}
      />

      <TextInput
        style={[styles.input, styles.commentInput, { borderColor: theme.border, color: theme.text }]}
        placeholder="Enter a comment (optional)"
        placeholderTextColor={theme.placeholder}
        multiline
        value={comment}
        onChangeText={setComment}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.button }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.submitButtonText, { color: theme.buttonText }]}>Submit Review</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  commentInput: { height: 100, textAlignVertical: "top" },
  buttonContainer: { flexDirection: "row", justifyContent: "space-between" },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  submitButtonText: { fontSize: 16, fontWeight: "bold" },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 16 },
});

export default CreateReview;