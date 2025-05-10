import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  Image,
  Linking } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { format } from "date-fns";
import { Meal } from "../../../../types/types";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const MyMealInfo = () => {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMeal = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${BASE_URL}/meal/meals/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 200) {
        setMeal(response.data);
      }
    } catch (error) {
      console.error("Error fetching meal:", error);
    }
  };

  const handleAddToMealPlan = async () => {
    if (!selectedDate) {
      Alert.alert("Error", "Please select a date.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await axios.post(
        `${BASE_URL}/mealplan/meal-plan`,
        {
          meal_id: id,
          date: selectedDate,
          meal_type: mealType,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 201) {
        Alert.alert("Success", "Meal added to the meal plan!");
        setIsModalVisible(false);
        setSelectedDate("");
        setMealType("Breakfast");
      }
    } catch (error) {
      console.error("Error adding meal to meal plan:", error);
      Alert.alert("Error", "Failed to add meal to the meal plan. Please try again later.");
    }
  };

  const handleDateSelection = (date: Date): void => {
    const formattedDate: string = format(date, "yyyy-MM-dd");
    setSelectedDate(formattedDate);
  };

  const handleDeleteMeal = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await axios.delete(`${BASE_URL}/meal/meals/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200) {
        Alert.alert("Success", "Meal deleted successfully!");
        router.back();
      } else {
        Alert.alert("Error", "Failed to delete the meal. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting meal:", error);
      Alert.alert("Error", "An error occurred while deleting the meal.");
    }
  };

  React.useEffect(() => {
    fetchMeal();
  }, [id]);

  if (!meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.background }]}>
      {/* Meal Picture */}
      {meal.picture ? (
        <Image
          source={{ uri: typeof meal.picture === "string" ? meal.picture : "" }}
          style={styles.mealImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.card }]}>
          <Text style={[styles.placeholderText, { color: theme.subtext }]}>No Image Available</Text>
        </View>
      )}

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Meal Name */}
        <Text style={[styles.title, { color: theme.text }]}>{meal.name}</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.subtext }]}>{meal.description}</Text>

        {/* Instructions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
        <Text style={[styles.details, { color: theme.text }]}>{meal.instructions}</Text>

        {/* Meal Link */}
        {meal.recipeLink && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recipe Link</Text>
            <Text
              style={[styles.linkText, { color: theme.primary }]}
              onPress={() => meal.recipeLink && Linking.openURL(meal.recipeLink)}
            >
              {meal.recipeLink}
            </Text>
          </>
        )}
        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
        <Text style={[styles.details, { color: theme.text }]}>{meal.ingredients}</Text>

        {/* Nutrition Info */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition Info</Text>
        <View style={styles.nutritionContainer}>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Calories: {meal.calories}
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Protein: {meal.protein}g
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Carbs: {meal.carbohydrates}g
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Fat: {meal.fat}g
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => setIsModalVisible(true)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add to Meal Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/my-meals/${id}/edit`)} // Navigate to the edit screen
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Edit Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.danger }]}
          onPress={handleDeleteMeal}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Delete Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Adding to Meal Plan */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Meal Plan</Text>

            <TouchableOpacity
              style={[styles.input, { borderColor: theme.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: theme.text }}>
                {selectedDate ? selectedDate : "Select Date"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ? new Date(selectedDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    handleDateSelection(date);
                  }
                }}
              />
            )}

            <View style={[styles.pickerContainer, { borderColor: theme.border }]}>
              <Picker
                selectedValue={mealType}
                onValueChange={(itemValue) => setMealType(itemValue)}
                style={{ color: theme.text }}
              >
                <Picker.Item label="Breakfast" value="Breakfast" />
                <Picker.Item label="Lunch" value="Lunch" />
                <Picker.Item label="Dinner" value="Dinner" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleAddToMealPlan}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>{loading ? "Adding..." : "Add"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.danger }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    width: "100%",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  mealImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholder: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "bold",
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
  details: {
    fontSize: 14,
    marginBottom: 8,
  },
  nutritionContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  linkText: {
    fontSize: 16,
    textDecorationLine: "underline",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
});

export default MyMealInfo;