import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, Platform, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Meal } from "@/types/types";
import { useTheme } from "@/context/ThemeContext";
import { ScrollView } from "react-native";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

interface MealDetailsProps {
  meal: Meal;
  onBack: () => void;
  onAddReview: (meal: Meal) => void;
  onViewReviews: (meal: Meal) => void;
}

const MealDetails: React.FC<MealDetailsProps> = ({ meal, onBack, onAddReview, onViewReviews }) => {
  const { theme } = useTheme();
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const handleReportMeal = async (mealId: number, reason: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await fetch(`${BASE_URL}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          meal_id: mealId,
          reason,
        }),
      });

      if (response.ok) {
        Alert.alert("Success", "Meal reported successfully!");
      } else {
        const error = await response.text();
        console.error("Error response:", error);
        Alert.alert("Error", `Failed to report meal: ${error}`);
      }
    } catch (err) {
      console.error("Error reporting meal:", err);
      Alert.alert("Error", "An error occurred while reporting the meal.");
    }
  };

  const handleAddMeal = async (meal: Meal) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await fetch(`${BASE_URL}/add-meal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: meal.name,
          description: meal.description,
          ingredients: meal.ingredients,
          calories: meal.calories,
          protein: meal.protein,
          carbohydrates: meal.carbohydrates,
          fat: meal.fat,
        }),
      });

      if (response.ok) {
        Alert.alert("Success", "Meal added successfully!");
      } else {
        const error = await response.text();
        console.error("Error response:", error);
        Alert.alert("Error", `Failed to add meal: ${error}`);
      }
    } catch (err) {
      console.error("Error adding meal:", err);
      Alert.alert("Error", "An error occurred while adding the meal.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {typeof meal.picture === "string" ? (
    <Image source={{ uri: meal.picture }} style={styles.mealPicture} />
  ) : (
    <View style={styles.mealPicturePlaceholder}>
      <Text style={[styles.mealPicturePlaceholderText, { color: theme.placeholder }]}>
        No Picture
      </Text>
    </View>
  )}
      <Text style={[styles.title, { color: theme.text }]}>{meal.name}</Text>
      <Text style={[styles.description, { color: theme.subtext }]}>{meal.description}</Text>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients:</Text>
      <Text style={[styles.ingredients, { color: theme.text }]}>{meal.ingredients}</Text>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutritional Information:</Text>
      <Text style={[styles.nutrition, { color: theme.text }]}>Calories: {meal.calories}</Text>
      <Text style={[styles.nutrition, { color: theme.text }]}>Protein: {meal.protein}g</Text>
      <Text style={[styles.nutrition, { color: theme.text }]}>Carbohydrates: {meal.carbohydrates}g</Text>
      <Text style={[styles.nutrition, { color: theme.text }]}>Fat: {meal.fat}g</Text>
      <Text style={[styles.user, { color: theme.subtext }]}>Created by: {meal.userName}</Text>

      {/* Add Review Button */}
      <TouchableOpacity
        style={[styles.addReviewButton, { backgroundColor: theme.button }]}
        onPress={() => onAddReview(meal)}
      >
        <Text style={[styles.addReviewButtonText, { color: theme.buttonText }]}>Add Review</Text>
      </TouchableOpacity>

      {/* View Reviews Button */}
      <TouchableOpacity
        style={[styles.viewReviewsButton, { backgroundColor: theme.button }]}
        onPress={() => onViewReviews(meal)}
      >
        <Text style={[styles.viewReviewsButtonText, { color: theme.buttonText }]}>View Reviews</Text>
      </TouchableOpacity>

      {/* Add Meal Button */}
      <TouchableOpacity
        style={[styles.addMealButton, { backgroundColor: theme.button }]}
        onPress={() => handleAddMeal(meal)}
      >
        <Text style={[styles.addMealButtonText, { color: theme.buttonText }]}>Add Meal</Text>
      </TouchableOpacity>

      {/* Report Meal Button */}
      <TouchableOpacity
        style={[styles.reportMealButton, { backgroundColor: theme.button }]}
        onPress={() => setIsReportModalVisible(true)}
      >
        <Text style={[styles.reportMealButtonText, { color: theme.buttonText }]}>Report Meal</Text>
      </TouchableOpacity>

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.button }]}
        onPress={onBack}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>

      {/* Report Modal */}
      <Modal
        visible={isReportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsReportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Report Meal</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.text }]}
              placeholder="Enter reason for reporting"
              placeholderTextColor={theme.placeholder}
              value={reportReason}
              onChangeText={setReportReason}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.button }]}
                onPress={() => {
                  if (reportReason.trim() === "") {
                    Alert.alert("Error", "Reason cannot be empty.");
                    return;
                  }
                  handleReportMeal(meal.id, reportReason);
                  setIsReportModalVisible(false);
                  setReportReason("");
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.danger }]}
                onPress={() => {
                  setIsReportModalVisible(false);
                  setReportReason("");
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  ingredients: {
    fontSize: 16,
    marginBottom: 16,
  },
  nutrition: {
    fontSize: 16,
    marginBottom: 8,
  },
  user: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  addReviewButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  addReviewButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  viewReviewsButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  viewReviewsButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  addMealButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  addMealButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  reportMealButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  reportMealButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  backButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  mealPicture: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#ccc",
    alignSelf: "center",
  },
  mealPicturePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginBottom: 16,
    alignSelf: "center",
  },
  mealPicturePlaceholderText: {
    fontSize: 16,
    color: "#888",
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
});

export default MealDetails;