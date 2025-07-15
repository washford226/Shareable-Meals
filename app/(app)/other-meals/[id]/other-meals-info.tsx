import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../../../context/ThemeContext";
import { Meal } from "../../../../types/types";
import { supabase } from "utils/supabase";

const MealDetails = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  // Fetch meal by id from Supabase
  const fetchMealById = async (mealId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("id", mealId)
        .single();

      if (error || !data) {
        Alert.alert("Error", "Failed to fetch meal details.");
        setMeal(null);
      } else {
        setMeal(data);
      }
    } catch (error) {
      console.error("Error fetching meal:", error);
      Alert.alert("Error", "An error occurred while fetching meal details.");
      setMeal(null);
    } finally {
      setLoading(false);
    }
  };

  // Report meal (insert into a 'reports' table)
  const handleReportMeal = async () => {
    try {
      if (!meal) {
        Alert.alert("Error", "Meal details are not available.");
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
      const userId = userData.user.id;

      const { error } = await supabase.from("reports").insert([
        {
          meal_id: meal.id,
          user_id: userId,
          reason: reportReason,
        },
      ]);

      if (error) {
        Alert.alert("Error", "Failed to report meal.");
      } else {
        Alert.alert("Success", "Meal reported successfully!");
        setIsReportModalVisible(false);
        setReportReason("");
      }
    } catch (err) {
      console.error("Error reporting meal:", err);
      Alert.alert("Error", "An error occurred while reporting the meal.");
    }
  };

  // Copy meal to user's meals
  const handleCopyMeal = async () => {
    try {
      if (!meal) {
        Alert.alert("Error", "Meal details are not available.");
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
      const userId = userData.user.id;

      // Copy all fields except id and user_id
      const { id: _id, user_id: _user_id, ...mealData } = meal;
      const { error } = await supabase.from("meals").insert([
        {
          ...mealData,
          user_id: userId,
        },
      ]);

      if (error) {
        Alert.alert("Error", "Failed to copy meal.");
      } else {
        Alert.alert("Success", "Meal copied successfully!");
      }
    } catch (err) {
      console.error("Error copying meal:", err);
      Alert.alert("Error", "An error occurred while copying the meal.");
    }
  };

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchMealById(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal details...</Text>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>Meal not found.</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Meal Picture */}
        {meal.picture && typeof meal.picture === "string" ? (
          <Image source={{ uri: meal.picture }} style={styles.mealPicture} resizeMode="cover" />
        ) : (
          <View style={styles.mealPicturePlaceholder}>
            <Text style={[styles.mealPicturePlaceholderText, { color: theme.placeholder }]}>No Picture</Text>
          </View>
        )}

        {/* Meal Name */}
        <Text style={[styles.title, { color: theme.text }]}>{meal.name}</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.subtext }]}>{meal.description}</Text>

        {/* Instructions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
        <Text style={[styles.details, { color: theme.text }]}>{meal.instructions}</Text>

        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
        {Array.isArray(meal.ingredients) ? (
          meal.ingredients.length > 0 ? (
            meal.ingredients.map((ing: any, idx: number) => (
              <Text key={idx} style={[styles.details, { color: theme.text }]}>
                {ing.quantity} {ing.unit} {ing.name}
              </Text>
            ))
          ) : (
            <Text style={[styles.details, { color: theme.text }]}>No ingredients listed.</Text>
          )
        ) : (
          <Text style={[styles.details, { color: theme.text }]}>{meal.ingredients}</Text>
        )}

        {/* Cuisine */}
        {meal.cuisine && (
          <Text style={[styles.details, { color: theme.text, fontWeight: "bold", marginBottom: 8 }]}>
            Cuisine: {meal.cuisine}
          </Text>
        )}

        {/* Nutrition Info */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition Info</Text>
        <View style={styles.nutritionContainer}>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Calories: {meal.calories}</Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Protein: {meal.protein}g</Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Carbs: {meal.carbohydrates}g</Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>Fat: {meal.fat}g</Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/(app)/reviews/${meal.id}/create-review`)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add Review</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/(app)/reviews/${meal.id}/reviews`)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>View Reviews</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={handleCopyMeal}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.danger }]}
          onPress={() => setIsReportModalVisible(true)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Report Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>

        {/* Report Modal */}
        <Modal visible={isReportModalVisible} transparent animationType="slide">
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
                  onPress={handleReportMeal}
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
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    color: "#6c757d",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "left",
  },
  details: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
    textAlign: "left",
  },
  nutritionContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    marginTop: 8,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    color: "#dc3545",
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
    textAlign: "center",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    borderColor: "#ccc",
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
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: "center",
  },
  mealPicturePlaceholder: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 16,
  },
  mealPicturePlaceholderText: {
    fontSize: 16,
    color: "#6c757d",
  },
});

export default MealDetails;